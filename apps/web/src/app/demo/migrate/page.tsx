'use client'

import { useState, useRef } from 'react'
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
  { value: 'home_phone', label: 'Home Phone' },
  { value: 'membership_type', label: 'Membership Type' },
  { value: 'status', label: 'Status' },
  { value: 'join_date', label: 'Join Date' },
  { value: 'last_visit', label: 'Last Visit' },
  { value: 'client_id', label: 'Client ID' },
  { value: 'notes', label: 'Notes' },
  { value: 'address', label: 'Address' },
  { value: 'city', label: 'City' },
  { value: 'state', label: 'State' },
  { value: 'zip', label: 'Zip' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'gender', label: 'Gender' },
  { value: 'source', label: 'Source' },
  { value: 'account_balance', label: 'Account Balance' },
  { value: '', label: '-- Skip --' },
]

const COLUMN_PATTERNS: { target: string; patterns: RegExp[]; required: boolean }[] = [
  { target: 'name', patterns: [/^first\s*name$/i, /^full\s*name$/i, /^name$/i, /^client\s*name$/i, /^customer\s*name$/i], required: true },
  { target: 'last_name', patterns: [/^last\s*name$/i, /^surname$/i, /^family\s*name$/i], required: false },
  { target: 'email', patterns: [/^e?-?mail$/i, /^email[_\s]*address$/i, /^e-?mail[_\s]*address$/i], required: true },
  { target: 'phone', patterns: [/^phone([_\s]*number)?$/i, /^mobile([_\s]*phone)?$/i, /^cell([_\s]*phone)?$/i, /^tel(ephone)?$/i], required: false },
  { target: 'membership_type', patterns: [/^membership\s*type$/i, /^plan$/i, /^subscription$/i, /^active\s*memberships?$/i, /^pricing\s*option$/i], required: false },
]

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]!)
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { fields.push(current.trim()); current = '' }
      else current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function autoDetectColumns(headers: string[]): MigrationColumn[] {
  const cols: MigrationColumn[] = []
  const used = new Set<string>()
  for (const mapping of COLUMN_PATTERNS) {
    for (const header of headers) {
      if (used.has(header)) continue
      if (mapping.patterns.some(p => p.test(header))) {
        cols.push({ source: header, target: mapping.target, required: mapping.required })
        used.add(header)
        break
      }
    }
  }
  return cols
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateRows(rows: Record<string, string>[], columns: MigrationColumn[]): MigrationRow[] {
  return rows.map(row => {
    const errors: string[] = []
    for (const col of columns) {
      const val = (row[col.source] ?? '').trim()
      if (col.required && !val) errors.push(`${col.target} is required`)
      if (val && col.target === 'email' && !EMAIL_RE.test(val)) errors.push('Invalid email')
    }
    return { data: row, valid: errors.length === 0, errors }
  })
}

export default function DemoMigratePage() {
  const [step, setStep] = useState<MigrationStep>('upload')
  const [source, setSource] = useState<'mindbody' | 'vagaro' | 'csv'>('mindbody')
  const [csvContent, setCsvContent] = useState('')
  const [columns, setColumns] = useState<MigrationColumn[]>([])
  const [preview, setPreview] = useState<MigrationPreview | null>(null)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [executing, setExecuting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      setCsvContent(text)
      analyzeCSV(text)
    }
    reader.readAsText(file)
  }

  function analyzeCSV(csv: string) {
    const rows = parseCSV(csv)
    if (rows.length === 0) return
    const headers = Object.keys(rows[0]!)
    const detectedColumns = autoDetectColumns(headers)
    const validated = validateRows(rows, detectedColumns)
    setColumns(detectedColumns)
    setPreview({
      totalRows: rows.length,
      validRows: validated.filter(r => r.valid).length,
      invalidRows: validated.filter(r => !r.valid).length,
      columns: detectedColumns,
      sampleRows: validated.slice(0, 5),
    })
    setStep('mapping')
  }

  function handleRepreview() {
    const rows = parseCSV(csvContent)
    const validated = validateRows(rows, columns)
    setPreview({
      totalRows: rows.length,
      validRows: validated.filter(r => r.valid).length,
      invalidRows: validated.filter(r => !r.valid).length,
      columns,
      sampleRows: validated.slice(0, 5),
    })
    setStep('preview')
  }

  function runImport() {
    if (!preview) return
    setExecuting(true)
    // Simulate import with a brief delay
    setTimeout(() => {
      const created = preview.validRows
      const skipped = Math.floor(preview.validRows * 0.1)
      setResult({
        totalProcessed: preview.totalRows,
        created: created - skipped,
        skipped,
        failed: preview.invalidRows,
        errors: preview.sampleRows
          .filter(r => !r.valid)
          .map((r, i) => ({ row: i + 1, email: r.data['Email'] ?? r.data['email'] ?? '', error: r.errors.join(', ') })),
      })
      setStep('done')
      setExecuting(false)
    }, 1500)
  }

  function updateColumnTarget(index: number, target: string) {
    setColumns(prev => prev.map((col, i) => i === index ? { ...col, target } : col))
  }

  function loadSampleData() {
    let sample: string

    if (source === 'mindbody') {
      sample = `ID,First Name,Last Name,Email,Phone,Home Phone,Mobile Phone,Date Added,Last Visit,Status,Active Memberships,Account Balance
1001,Sarah,Chen,sarah.chen@email.com,+64 21 555 0101,,+64 21 555 0101,2023-01-15,2024-12-20,Active,Unlimited Monthly,$0.00
1002,James,Wilson,james.w@email.com,+64 22 555 0102,+64 9 555 0102,,2023-03-20,2024-12-18,Active,8-Class Pack,$15.00
1003,Tina,Ruiz,tina.ruiz@email.com,+64 21 555 0103,,,2023-06-01,2024-11-30,Active,Unlimited Monthly,$0.00
1004,Mike,Johnson,mike.j@email.com,+64 21 555 0104,,+64 21 555 0104,2023-02-10,2024-12-15,Active,Drop-In,$0.00
1005,Emily,Brooks,emily.b@email.com,+64 22 555 0105,,,2023-08-22,2024-12-19,Active,8-Class Pack,$0.00
1006,David,Kim,,+64 21 555 0106,,+64 21 555 0106,2023-04-05,2024-10-01,Inactive,,$0.00
1007,Priya,Patel,priya.p@email.com,+64 22 555 0107,,,2023-07-12,2024-12-17,Active,Unlimited Monthly,$0.00
1008,Alex,Turner,alex.turner@email.com,+64 21 555 0108,,+64 21 555 0108,2023-05-18,2024-12-20,Active,8-Class Pack,$0.00
1009,Lisa,Martinez,invalid-email,+64 22 555 0109,,,2023-09-30,2024-11-15,Active,Drop-In,$25.00
1010,Tom,Brown,tom.brown@email.com,+64 21 555 0110,,+64 21 555 0110,2023-01-08,2024-12-19,Active,Unlimited Monthly,$0.00
1011,Nina,Kowalski,nina.k@email.com,+64 22 555 0111,,,2023-11-01,2024-12-10,Active,8-Class Pack,$0.00
1012,Ryan,Foster,ryan.f@email.com,+64 22 555 0112,,,2023-03-15,2024-12-16,Active,Unlimited Monthly,$0.00`
    } else if (source === 'vagaro') {
      sample = `First Name,Last Name,Email,Mobile Phone,Home Phone,Address,City,State,Zip,Birthday,Gender,Notes,Last Appointment,Customer Since,Source
Sarah,Chen,sarah.chen@email.com,+64 21 555 0101,,12 Queen St,Auckland,,1010,1990-05-15,Female,,2024-12-20,2023-01-15,Website
James,Wilson,james.w@email.com,+64 22 555 0102,+64 9 555 0102,45 High St,Wellington,,6011,,Male,VIP client,2024-12-18,2023-03-20,Referral
Tina,Ruiz,tina.ruiz@email.com,+64 21 555 0103,,8 Ponsonby Rd,Auckland,,1011,1985-11-22,Female,,2024-11-30,2023-06-01,Walk-in
Mike,Johnson,mike.j@email.com,+64 21 555 0104,,,Christchurch,,8011,1992-03-08,Male,,2024-12-15,2023-02-10,Instagram
Emily,Brooks,emily.b@email.com,+64 22 555 0105,,23 Cuba St,Wellington,,6011,1988-07-30,Female,Morning classes only,2024-12-19,2023-08-22,Website
David,Kim,,+64 21 555 0106,,100 Symonds St,Auckland,,1010,,Male,,2024-10-01,2023-04-05,Referral
Priya,Patel,priya.p@email.com,+64 22 555 0107,,5 Victoria St,Hamilton,,3204,1995-01-12,Female,,2024-12-17,2023-07-12,Google
Alex,Turner,alex.turner@email.com,+64 21 555 0108,,67 Karangahape Rd,Auckland,,1010,1991-09-25,Male,,2024-12-20,2023-05-18,Website
Lisa,Martinez,invalid-email,+64 22 555 0109,,34 Courtenay Pl,Wellington,,6011,1987-04-18,Female,Prefers evening classes,2024-11-15,2023-09-30,Walk-in
Tom,Brown,tom.brown@email.com,+64 21 555 0110,,9 Lambton Quay,Wellington,,6011,1993-12-03,Male,,2024-12-19,2023-01-08,Website
Nina,Kowalski,nina.k@email.com,+64 22 555 0111,,22 Mt Eden Rd,Auckland,,1024,,Female,,2024-12-10,2023-11-01,Referral
Ryan,Foster,ryan.f@email.com,+64 22 555 0112,,18 Broadway,Newmarket,,1023,1989-06-14,Male,,2024-12-16,2023-03-15,Instagram`
    } else {
      sample = `First Name,Last Name,Email,Phone,Membership Type
Sarah,Chen,sarah.chen@email.com,+64 21 555 0101,Unlimited Monthly
James,Wilson,james.w@email.com,+64 22 555 0102,8-Class Pack
Tina,Ruiz,tina.ruiz@email.com,,Unlimited Monthly
Mike,Johnson,mike.j@email.com,+64 21 555 0104,Drop-In
Emily,Brooks,emily.b@email.com,+64 22 555 0105,8-Class Pack
David,Kim,,+64 21 555 0106,Unlimited Monthly
Priya,Patel,priya.p@email.com,+64 22 555 0107,Unlimited Monthly
Alex,Turner,alex.turner@email.com,+64 21 555 0108,8-Class Pack
Lisa,Martinez,invalid-email,+64 22 555 0109,Drop-In
Tom,Brown,tom.brown@email.com,+64 21 555 0110,Unlimited Monthly
Nina,Kowalski,nina.k@email.com,,8-Class Pack
Ryan,Foster,ryan.f@email.com,+64 22 555 0112,Unlimited Monthly`
    }

    setCsvContent(sample)
    analyzeCSV(sample)
  }

  const stepIndex = ['upload', 'mapping', 'preview', 'confirm', 'done'].indexOf(step)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Migrate to Studio Co-op</h1>
        <p className="text-muted-foreground">Import your members from your current platform</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
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
                  <li>Go to Reports &rarr; Client Reports &rarr; Client Export</li>
                  <li>Select all fields and date range</li>
                  <li>Click Export to CSV</li>
                  <li>Upload the file below</li>
                </ol>
              </div>
            )}

            {source === 'vagaro' && (
              <div className="bg-blue-50 p-4 rounded-lg text-sm">
                <p className="font-medium text-blue-900 mb-2">How to export from Vagaro:</p>
                <ol className="list-decimal ml-4 space-y-1 text-blue-800">
                  <li>Log in to your Vagaro business account</li>
                  <li>Go to Customers &rarr; Customer List</li>
                  <li>Click the Export button (top-right)</li>
                  <li>Select CSV format and choose the fields to include</li>
                  <li>Click Export and save the file</li>
                  <li>Upload the file below</li>
                </ol>
              </div>
            )}

            <div>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} className="w-full" size="lg">
                Upload CSV File
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Or paste CSV content directly</label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm min-h-[100px] font-mono mt-1"
                value={csvContent}
                onChange={e => setCsvContent(e.target.value)}
                placeholder="First Name,Last Name,Email,Phone&#10;John,Doe,john@example.com,+1234567890"
              />
              <div className="flex gap-2 mt-2">
                <Button variant="outline" onClick={() => analyzeCSV(csvContent)} disabled={!csvContent.trim()}>
                  Analyze CSV
                </Button>
                <Button variant="ghost" onClick={loadSampleData}>
                  Load sample data
                </Button>
              </div>
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
                      <th className="px-3 py-2 text-left text-xs font-medium">Status</th>
                      {columns.map(col => (
                        <th key={col.source} className="px-3 py-2 text-left text-xs font-medium">{col.source}</th>
                      ))}
                      <th className="px-3 py-2 text-left text-xs font-medium">Errors</th>
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
                      <th className="px-3 py-2 text-left text-xs font-medium">Row</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium">Error</th>
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
            <Button onClick={() => setStep('upload')} className="w-full">Start Another Import</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
