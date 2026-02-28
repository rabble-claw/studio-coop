// Mindbody CSV migration parser + validator

export interface MigrationColumn {
  source: string
  target: string
  required: boolean
}

export interface MigrationRow {
  data: Record<string, string>
  valid: boolean
  errors: string[]
}

export interface MigrationPreview {
  totalRows: number
  validRows: number
  invalidRows: number
  columns: MigrationColumn[]
  sampleRows: MigrationRow[]
}

// ── CSV Parser ───────────────────────────────────────────────────────────────

export function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }

  return rows
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

// ── Column Auto-Detection ────────────────────────────────────────────────────

const COLUMN_MAPPINGS: { target: string; patterns: RegExp[]; required: boolean }[] = [
  {
    target: 'name',
    patterns: [
      /^first\s*name$/i,
      /^full\s*name$/i,
      /^name$/i,
      /^client\s*name$/i,
      /^member\s*name$/i,
    ],
    required: true,
  },
  {
    target: 'last_name',
    patterns: [
      /^last\s*name$/i,
      /^surname$/i,
      /^family\s*name$/i,
    ],
    required: false,
  },
  {
    target: 'email',
    patterns: [
      /^e?-?mail$/i,
      /^email[_\s]*address$/i,
      /^e-?mail[_\s]*address$/i,
    ],
    required: true,
  },
  {
    target: 'phone',
    patterns: [
      /^(mobile\s*)?phone([_\s]*number)?$/i,
      /^phone$/i,
      /^cell([_\s]*phone)?$/i,
      /^mobile$/i,
      /^tel$/i,
    ],
    required: false,
  },
  {
    target: 'membership_type',
    patterns: [
      /^membership\s*type$/i,
      /^plan$/i,
      /^subscription$/i,
      /^membership$/i,
      /^package$/i,
    ],
    required: false,
  },
]

export function autoDetectColumns(headers: string[]): MigrationColumn[] {
  const columns: MigrationColumn[] = []
  const usedHeaders = new Set<string>()

  for (const mapping of COLUMN_MAPPINGS) {
    for (const header of headers) {
      if (usedHeaders.has(header)) continue
      for (const pattern of mapping.patterns) {
        if (pattern.test(header)) {
          columns.push({
            source: header,
            target: mapping.target,
            required: mapping.required,
          })
          usedHeaders.add(header)
          break
        }
      }
      if (usedHeaders.has(header)) break
    }
  }

  return columns
}

// ── Row Validation ───────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s\-().]{7,20}$/

export function validateRow(
  row: Record<string, string>,
  columns: MigrationColumn[]
): MigrationRow {
  const errors: string[] = []

  for (const col of columns) {
    const value = (row[col.source] ?? '').trim()

    if (col.required && !value) {
      errors.push(`${col.target} is required`)
      continue
    }

    if (!value) continue

    if (col.target === 'email' && !EMAIL_RE.test(value)) {
      errors.push('Invalid email format')
    }

    if (col.target === 'phone' && !PHONE_RE.test(value)) {
      errors.push('Invalid phone format')
    }
  }

  return {
    data: row,
    valid: errors.length === 0,
    errors,
  }
}

// ── Preview Generation ───────────────────────────────────────────────────────

export function generatePreview(
  rows: Record<string, string>[],
  columns: MigrationColumn[]
): MigrationPreview {
  const validatedRows = rows.map((r) => validateRow(r, columns))
  const validRows = validatedRows.filter((r) => r.valid).length
  const invalidRows = validatedRows.filter((r) => !r.valid).length

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    columns,
    sampleRows: validatedRows.slice(0, 5),
  }
}
