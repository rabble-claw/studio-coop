/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isDemoMode,
  demoStudio,
  demoTeachers,
  demoTemplates,
  demoClasses,
  demoMembers,
} from '@/lib/demo-data'

// ── isDemoMode ─────────────────────────────────────────────────────────────

describe('isDemoMode', () => {
  const originalValue = process.env.NEXT_PUBLIC_SUPABASE_URL

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalValue
    }
  })

  it('returns true when env var is not set', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(isDemoMode()).toBe(true)
  })

  it('returns true when env var includes "placeholder"', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co'
    expect(isDemoMode()).toBe(true)
  })

  it('returns true when env var includes "your-project"', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://your-project.supabase.co'
    expect(isDemoMode()).toBe(true)
  })

  it('returns false when env var is a real URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefg.supabase.co'
    expect(isDemoMode()).toBe(false)
  })
})

// ── demoTemplates ──────────────────────────────────────────────────────────

describe('demoTemplates', () => {
  it('contains at least one template', () => {
    expect(demoTemplates.length).toBeGreaterThan(0)
  })

  it('all templates have required fields', () => {
    for (const tpl of demoTemplates) {
      expect(tpl.id, `${tpl.id} missing id`).toBeTruthy()
      expect(tpl.name, `${tpl.id} missing name`).toBeTruthy()
      expect(tpl.description, `${tpl.id} missing description`).toBeTruthy()
      expect(typeof tpl.default_duration_min).toBe('number')
      expect(typeof tpl.default_capacity).toBe('number')
    }
  })

  it('all template durations are positive', () => {
    for (const tpl of demoTemplates) {
      expect(tpl.default_duration_min, `${tpl.id} duration`).toBeGreaterThan(0)
    }
  })

  it('all template capacities are positive', () => {
    for (const tpl of demoTemplates) {
      expect(tpl.default_capacity, `${tpl.id} capacity`).toBeGreaterThan(0)
    }
  })

  it('all template IDs are unique', () => {
    const ids = demoTemplates.map((t) => t.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ── demoTeachers ───────────────────────────────────────────────────────────

describe('demoTeachers', () => {
  it('contains at least one teacher', () => {
    expect(demoTeachers.length).toBeGreaterThan(0)
  })

  it('all teachers have id, name, and email', () => {
    for (const t of demoTeachers) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.email).toBeTruthy()
    }
  })

  it('all teacher IDs are unique', () => {
    const ids = demoTeachers.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── demoStudio ─────────────────────────────────────────────────────────────

describe('demoStudio', () => {
  it('has required fields', () => {
    expect(demoStudio.id).toBeTruthy()
    expect(demoStudio.name).toBeTruthy()
    expect(demoStudio.slug).toBeTruthy()
    expect(demoStudio.timezone).toBeTruthy()
  })
})

// ── demoClasses (schedule generation) ─────────────────────────────────────

describe('demoClasses (schedule generation)', () => {
  it('generates a non-empty list of classes', () => {
    expect(demoClasses.length).toBeGreaterThan(0)
  })

  it('all class IDs are unique', () => {
    const ids = demoClasses.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all classes reference a valid template ID', () => {
    const validTemplateIds = new Set(demoTemplates.map((t) => t.id))
    for (const cls of demoClasses) {
      expect(validTemplateIds.has(cls.template_id), `class ${cls.id} has unknown template_id "${cls.template_id}"`).toBe(true)
    }
  })

  it('all classes reference a valid teacher ID', () => {
    const validTeacherIds = new Set(demoTeachers.map((t) => t.id))
    for (const cls of demoClasses) {
      expect(validTeacherIds.has(cls.teacher_id), `class ${cls.id} has unknown teacher_id "${cls.teacher_id}"`).toBe(true)
    }
  })

  it('booked_count never exceeds max_capacity', () => {
    for (const cls of demoClasses) {
      expect(cls.booked_count, `class ${cls.id}`).toBeLessThanOrEqual(cls.max_capacity)
    }
  })

  it('booked_count is non-negative', () => {
    for (const cls of demoClasses) {
      expect(cls.booked_count, `class ${cls.id}`).toBeGreaterThanOrEqual(0)
    }
  })

  it('dates are valid YYYY-MM-DD strings', () => {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/
    for (const cls of demoClasses) {
      expect(cls.date, `class ${cls.id}`).toMatch(dateRe)
      expect(new Date(cls.date).getTime(), `class ${cls.id} date "${cls.date}" is not a real date`).not.toBeNaN()
    }
  })

  it('start_time and end_time are valid HH:MM:SS strings', () => {
    const timeRe = /^\d{2}:\d{2}:\d{2}$/
    for (const cls of demoClasses) {
      expect(cls.start_time, `class ${cls.id} start_time`).toMatch(timeRe)
      expect(cls.end_time, `class ${cls.id} end_time`).toMatch(timeRe)
    }
  })

  it('each class has template name and teacher name embedded', () => {
    for (const cls of demoClasses) {
      expect(cls.template.name, `class ${cls.id} template.name`).toBeTruthy()
      expect(cls.template.description, `class ${cls.id} template.description`).toBeTruthy()
      expect(cls.teacher.name, `class ${cls.id} teacher.name`).toBeTruthy()
    }
  })

  it('all classes have studio_id matching the demo studio', () => {
    for (const cls of demoClasses) {
      expect(cls.studio_id).toBe(demoStudio.id)
    }
  })

  it('all classes have "scheduled" status', () => {
    for (const cls of demoClasses) {
      expect(cls.status).toBe('scheduled')
    }
  })

  it('generates classes spanning at least 2 days', () => {
    const dates = new Set(demoClasses.map((c) => c.date))
    expect(dates.size).toBeGreaterThanOrEqual(2)
  })
})

// ── demoMembers ────────────────────────────────────────────────────────────

describe('demoMembers', () => {
  it('contains members and teachers', () => {
    expect(demoMembers.length).toBeGreaterThan(0)
  })

  it('all members have id, name, email, and role', () => {
    for (const m of demoMembers) {
      expect(m.id).toBeTruthy()
      expect(m.name).toBeTruthy()
      expect(m.email).toBeTruthy()
      expect(m.role).toBeTruthy()
    }
  })

  it('all member IDs are unique', () => {
    const ids = demoMembers.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least one owner', () => {
    expect(demoMembers.some((m) => m.role === 'owner')).toBe(true)
  })
})
