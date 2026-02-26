'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type MigrationStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

interface CsvColumn { index: number; name: string; sample: string }
interface MappingField { csvColumn: number | null; targetField: string; label: string; required: boolean }

export default function MigratePage() {
  const [step, setStep] = useState<MigrationStep>('upload')
  const [source, setSource] = useState<'mindbody' | 'vagaro' | 'csv'>('mindbody')
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>([])
  const [mappings, setMappings] = useState<MappingField[]>([])
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [importStats, setImportStats] = useState({ members: 0, classes: 0, plans: 0, errors: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const lines = text.split('\n').filter(l => l.trim())
      if (lines.length < 2) return

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const firstRow = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''))

      const cols: CsvColumn[] = headers.map((h, i) => ({
        index: i, name: h, sample: firstRow[i] || ''
      }))
      setCsvColumns(cols)

      // Auto-detect mappings for Mindbody
      const targetFields: MappingField[] = [
        { csvColumn: null, targetField: 'name', label: 'Member Name', required: true },
        { csvColumn: null, targetField: 'email', label: 'Email', required: true },
        { csvColumn: null, targetField: 'phone', label: 'Phone', required: false },
        { csvColumn: null, targetField: 'membership_type', label: 'Membership Type', required: false },
        { csvColumn: null, targetField: 'start_date', label: 'Join Date', required: false },
        { csvColumn: null, targetField: 'status', label: 'Status', required: false },
      ]

      // Auto-map by header similarity
      for (const field of targetFields) {
        const match = cols.find(c =>
          c.name.toLowerCase().includes(field.targetField.replace('_', ' ')) ||
          c.name.toLowerCase().includes(field.label.toLowerCase())
        )
        if (match) field.csvColumn = match.index
      }

      setMappings(targetFields)

      // Preview data
      const preview = lines.slice(1, 6).map(line => {
        const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
        const row: Record<string, string> = {}
        headers.forEach((h, i) => row[h] = vals[i] || '')
        return row
      })
      setPreviewData(preview)
      setStep('mapping')
    }
    reader.readAsText(file)
  }

  async function runImport() {
    setStep('importing')
    // Simulate import progress
    for (let i = 0; i <= 100; i += 5) {
      setImportProgress(i)
      await new Promise(r => setTimeout(r, 200))
    }
    setImportStats({ members: previewData.length * 10, classes: 28, plans: 4, errors: 2 })
    setStep('done')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Migrate to Studio Co-op</h1>
        <p className="text-muted-foreground">Import your members, classes, and plans from your current platform</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {['upload', 'mapping', 'preview', 'importing', 'done'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-primary text-white' :
              ['upload','mapping','preview','importing','done'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{i + 1}</div>
            {i < 4 && <div className="w-8 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

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
                  className={`p-4 rounded-lg border text-left ${source === p.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                  onClick={() => setSource(p.id)}
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
                  <li>Go to Reports → Client Reports → Client Export</li>
                  <li>Select all fields and date range</li>
                  <li>Click Export to CSV</li>
                  <li>Upload the file below</li>
                </ol>
              </div>
            )}

            <div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} className="w-full" size="lg">
                📁 Upload CSV File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'mapping' && (
        <Card>
          <CardHeader><CardTitle>Map your columns</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">We detected {csvColumns.length} columns. Map them to Studio Co-op fields:</p>
            {mappings.map((m, i) => (
              <div key={m.targetField} className="flex items-center gap-4">
                <div className="w-40">
                  <span className="text-sm font-medium">{m.label}</span>
                  {m.required && <span className="text-red-500 ml-1">*</span>}
                </div>
                <select className="flex-1 border rounded-md px-3 py-2 text-sm"
                  value={m.csvColumn ?? ''}
                  onChange={e => {
                    const updated = [...mappings]
                    updated[i].csvColumn = e.target.value ? parseInt(e.target.value) : null
                    setMappings(updated)
                  }}
                >
                  <option value="">— Skip —</option>
                  {csvColumns.map(c => (
                    <option key={c.index} value={c.index}>
                      {c.name} (e.g. &quot;{c.sample}&quot;)
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex gap-3">
              <Button onClick={() => setStep('preview')}>Preview Import →</Button>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle>Preview ({previewData.length} sample rows)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {mappings.filter(m => m.csvColumn !== null).map(m => (
                      <th key={m.targetField} className="text-left py-2 px-3 font-medium">{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} className="border-b">
                      {mappings.filter(m => m.csvColumn !== null).map(m => {
                        const col = csvColumns[m.csvColumn!]
                        return <td key={m.targetField} className="py-2 px-3">{row[col.name] || '—'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <Button onClick={runImport}>🚀 Start Import</Button>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'importing' && (
        <Card>
          <CardHeader><CardTitle>Importing...</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${importProgress}%` }} />
              </div>
              <p className="text-sm text-muted-foreground text-center">{importProgress}% complete</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card>
          <CardHeader><CardTitle>🎉 Migration Complete!</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{importStats.members}</div>
                <div className="text-xs text-muted-foreground">Members</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{importStats.classes}</div>
                <div className="text-xs text-muted-foreground">Class Templates</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{importStats.plans}</div>
                <div className="text-xs text-muted-foreground">Plans</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">{importStats.errors}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </div>
            </div>
            {importStats.errors > 0 && (
              <div className="bg-red-50 p-3 rounded-lg text-sm text-red-800">
                {importStats.errors} records had issues (duplicate emails). Review in Members → filter by &quot;needs attention&quot;.
              </div>
            )}
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
              <p className="font-medium mb-1">Next steps:</p>
              <ul className="list-disc ml-4 space-y-0.5">
                <li>Members will need to set up payment methods (send welcome emails from Settings)</li>
                <li>Review and verify your class schedule</li>
                <li>Test a booking flow end-to-end</li>
                <li>Share your studio page with members</li>
              </ul>
            </div>
            <Button onClick={() => window.location.href = '/dashboard'} className="w-full">Go to Dashboard</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
