'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { migrateApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type MigrationStep = 'upload' | 'mapping' | 'preview' | 'confirm' | 'done'

interface MigrationColumn { source: string; target: string; required: boolean }
interface MigrationRow { data: Record<string, string>; valid: boolean; errors: string[] }
interface MigrationPreview {
  totalRows: number; validRows: number; invalidRows: number
  columns: MigrationColumn[]; sampleRows: MigrationRow[]
}
interface MigrationResult {
  totalProcessed: number; created: number; skipped: number; failed: number
  errors: Array<{ row: number; email: string; error: string }>
}

const TARGET_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'membership_type', label: 'Membership Type' },
  { value: '', label: '-- Skip --' },
]

export default function MigratePage() {
  const router = useRouter()
  const [studioId, setStudioId] = useState<string | null>(null)
  const [step, setStep] = useState<MigrationStep>('upload')
  const [source, setSource] = useState<'mindbody' | 'vagaro' | 'csv'>('mindbody')
  const [csvContent, setCsvContent] = useState('')
  const [columns, setColumns] = useState<MigrationColumn[]>([])
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()
      if (membership) setStudioId(membership.studio_id)
    }
    load()
  }, [])

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result as string
      setCsvContent(text)
      await uploadCSV(text)
    }
    reader.readAsText(file)
  }

  async function uploadCSV(csv: string) {
    if (!studioId) return
    setError('')
    try {
      const res = await migrateApi.upload(studioId, csv)
      setPreview(res.preview)
      setColumns(res.preview.columns)
      setStep('mapping')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    }
  }

  async function handleRepreview() {
    if (!studioId) return
    setError('')
    try {
      const res = await migrateApi.preview(studioId, csvContent, columns)
      setPreview(res.preview)
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    }
  }

  async function runImport() {
    if (!studioId) return
    setExecuting(true)
    setError('')
    try {
      const res = await migrateApi.execute(studioId, csvContent, columns)
      setResult(res.result)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    }
    setExecuting(false)
  }

  function updateColumnTarget(index: number, target: string) {
    setColumns(prev => prev.map((col, i) => i === index ? { ...col, target } : col))
  }

  const stepIndex = ['upload', 'mapping', 'preview', 'confirm', 'done'].indexOf(step)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Migrate to Studio Co-op</h1>
        <p className="text-muted-foreground">Import your members from your current platform</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2" aria-live="polite" aria-label="Migration progress">
        {['Upload', 'Map Columns', 'Validate', 'Confirm', 'Results'].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              stepIndex === i ? 'bg-primary text-white' :
              stepIndex > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{stepIndex > i ? '\u2713' : i + 1}</div>
            <span className="text-xs hidden sm:inline">{label}</span>
            {i < 4 && <div className="w-6 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-2 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {step === 'upload' && (
        <Card>
          <CardHeader><CardTitle>Select your platform</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'mindbody' as const, label: 'Mindbody', desc: 'Export from Mindbody reports' },
                { id: 'vagaro' as const, label: 'Vagaro', desc: 'Export from Vagaro' },
                { id: 'csv' as const, label: 'Other (CSV)', desc: 'Upload any CSV file' },
              ].map(p => (
                <button key={p.id}
                  className={`p-4 rounded-lg border text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${source === p.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                  onClick={() => setSource(p.id)}
                  aria-pressed={source === p.id}
                >
                  <div className="font-medium">{p.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{p.desc}</div>
                </button>
              ))}
            </div>

            {source === 'mindbody' && (
              <div className="bg-blue-50 p-4 rounded-lg text-sm">
                <p className="font-medium text-blue-900 mb-2">How to export from Mindbody:</p>
                <ol className="list-decimal ml-4 space-y-1 text-blue-800">
                  <li>Go to Reports &rarr; Client Reports &rarr; Client Export</li>
                  <li>Select all fields and date range</li>
                  <li>Click Export to CSV</li>
                  <li>Upload the file below</li>
                </ol>
              </div>
            )}

            <div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" aria-label="Upload CSV file" />
              <Button onClick={() => fileRef.current?.click()} className="w-full" size="lg">
                Upload CSV File
              </Button>
            </div>

            <div>
              <label htmlFor="csv-paste" className="text-sm font-medium text-muted-foreground">Or paste CSV content directly</label>
              <textarea
                id="csv-paste"
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] font-mono mt-1"
                value={csvContent}
                onChange={e => setCsvContent(e.target.value)}
                placeholder="First Name,Last Name,Email,Phone&#10;John,Doe,john@example.com,+1234567890"
              />
              <Button variant="outline" className="mt-2" onClick={() => uploadCSV(csvContent)} disabled={!csvContent.trim()}>
                Analyze CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && preview && (
        <Card>
          <CardHeader><CardTitle>Map your columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We auto-detected {columns.length} column mappings. Adjust as needed:
            </p>
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-1/3">
                  <span className="text-sm font-medium">{col.source}</span>
                  <span className="text-xs text-muted-foreground ml-2">(CSV)</span>
                </div>
                <span className="text-muted-foreground">&rarr;</span>
                <select
                  value={col.target}
                  onChange={e => updateColumnTarget(i, e.target.value)}
                  className="flex-1 border rounded-md px-3 py-2 text-sm"
                  aria-label={`Map column "${col.source}" to field`}
                >
                  {TARGET_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {col.required && <span className="text-xs text-red-500">required</span>}
              </div>
            ))}
            <div className="flex gap-3">
              <Button onClick={handleRepreview}>Validate Data</Button>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && preview && (
        <Card>
          <CardHeader><CardTitle>Data Validation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold">{preview.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{preview.validRows}</p>
                <p className="text-sm text-muted-foreground">Valid</p>
              </div>
              <div className="p-4 border rounded-lg text-center">
                <p className="text-2xl font-bold text-red-600">{preview.invalidRows}</p>
                <p className="text-sm text-muted-foreground">Invalid</p>
              </div>
            </div>

            {preview.sampleRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium">Status</th>
                      {columns.map(col => (
                        <th scope="col" key={col.source} className="px-3 py-2 text-left text-xs font-medium">{col.source}</th>
                      ))}
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sampleRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          {row.valid
                            ? <span className="text-green-600 text-xs font-medium">OK</span>
                            : <span className="text-red-600 text-xs font-medium">Error</span>
                          }
                        </td>
                        {columns.map(col => (
                          <td key={col.source} className="px-3 py-2 text-xs">{row.data[col.source] ?? ''}</td>
                        ))}
                        <td className="px-3 py-2 text-xs text-red-600">{row.errors.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep('confirm')} disabled={preview.validRows === 0}>
                Continue
              </Button>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'confirm' && preview && (
        <Card>
          <CardHeader><CardTitle>Confirm Import</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <p className="font-medium">Ready to import {preview.validRows} members</p>
              <p className="text-sm text-muted-foreground mt-1">
                {preview.invalidRows > 0 && `${preview.invalidRows} invalid rows will be skipped. `}
                Existing members will not be duplicated.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={runImport} disabled={executing}>
                {executing ? 'Importing...' : 'Start Import'}
              </Button>
              <Button variant="outline" onClick={() => setStep('preview')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'done' && result && (
        <Card>
          <CardHeader><CardTitle>Migration Complete</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{result.totalProcessed}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{result.created}</div>
                <div className="text-xs text-muted-foreground">Created</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{result.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium">Row</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium">Email</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-medium">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{err.row}</td>
                        <td className="px-3 py-2">{err.email || '-'}</td>
                        <td className="px-3 py-2 text-red-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">Next steps:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Members will need to set up payment methods (send welcome emails from Settings)</li>
                <li>Review and verify your class schedule</li>
                <li>Test a booking flow end-to-end</li>
              </ul>
            </div>
            <Button onClick={() => window.location.href = '/dashboard'} className="w-full">Go to Dashboard</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
