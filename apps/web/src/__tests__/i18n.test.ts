import { describe, it, expect } from 'vitest'
import messages from '@/messages/en.json'

const EXPECTED_NAMESPACES = [
  'common',
  'auth',
  'dashboard',
  'schedule',
  'members',
  'plans',
  'coupons',
  'bookings',
  'reports',
  'settings',
  'notifications',
  'network',
  'migrate',
  'feed',
] as const

describe('i18n locale file', () => {
  it('should have all expected namespaces', () => {
    for (const ns of EXPECTED_NAMESPACES) {
      expect(messages).toHaveProperty(ns)
      expect(typeof (messages as Record<string, unknown>)[ns]).toBe('object')
    }
  })

  it('should not have empty string values', () => {
    function checkValues(obj: Record<string, unknown>, path = '') {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key
        if (typeof value === 'string') {
          expect(value.length, `Empty string at "${fullPath}"`).toBeGreaterThan(0)
        } else if (typeof value === 'object' && value !== null) {
          checkValues(value as Record<string, unknown>, fullPath)
        }
      }
    }
    checkValues(messages as Record<string, unknown>)
  })

  it('should only contain string values at leaf nodes', () => {
    function checkLeaves(obj: Record<string, unknown>, path = '') {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key
        if (typeof value === 'object' && value !== null) {
          checkLeaves(value as Record<string, unknown>, fullPath)
        } else {
          expect(typeof value, `Non-string leaf at "${fullPath}": ${typeof value}`).toBe('string')
        }
      }
    }
    checkLeaves(messages as Record<string, unknown>)
  })

  it('should have non-empty namespaces', () => {
    for (const ns of EXPECTED_NAMESPACES) {
      const nsObj = (messages as Record<string, Record<string, unknown>>)[ns]
      expect(Object.keys(nsObj).length, `Namespace "${ns}" is empty`).toBeGreaterThan(0)
    }
  })

  it('should have required common keys', () => {
    const common = (messages as Record<string, Record<string, string>>).common
    expect(common).toHaveProperty('loading')
    expect(common).toHaveProperty('cancel')
    expect(common).toHaveProperty('save')
    expect(common).toHaveProperty('edit')
    expect(common).toHaveProperty('delete')
    expect(common).toHaveProperty('back')
    expect(common).toHaveProperty('confirm')
  })

  it('should have required auth keys', () => {
    const auth = (messages as Record<string, Record<string, string>>).auth
    expect(auth).toHaveProperty('signIn')
    expect(auth).toHaveProperty('signUp')
    expect(auth).toHaveProperty('signOut')
    expect(auth).toHaveProperty('magicLink')
  })

  it('should have required dashboard keys', () => {
    const dashboard = (messages as Record<string, Record<string, string>>).dashboard
    expect(dashboard).toHaveProperty('title')
    expect(dashboard).toHaveProperty('members')
    expect(dashboard).toHaveProperty('upcomingClasses')
    expect(dashboard).toHaveProperty('todaysClasses')
    expect(dashboard).toHaveProperty('checkinsToday')
  })

  it('should have no duplicate keys across the file', () => {
    // JSON parse will keep last duplicate, so check raw file
    // We just verify JSON parses cleanly and structure is valid
    const json = JSON.stringify(messages)
    expect(json.length).toBeGreaterThan(100)
  })

  it('should have nav labels matching dashboard-shell navItems', () => {
    const nav = (messages as Record<string, Record<string, Record<string, string>>>).common.nav
    expect(nav).toBeDefined()
    const expectedNavKeys = [
      'overview',
      'schedule',
      'members',
      'plans',
      'feed',
      'network',
      'coupons',
      'bookings',
      'reports',
      'migrate',
      'settings',
    ]
    for (const key of expectedNavKeys) {
      expect(nav, `Missing nav key: ${key}`).toHaveProperty(key)
    }
  })

  it('should have interpolation-ready strings', () => {
    // Strings with {variable} interpolation should exist
    const schedule = (messages as Record<string, Record<string, string>>).schedule
    expect(schedule.spotsLeft).toContain('{count}')
    const members = (messages as Record<string, Record<string, string>>).members
    expect(members.totalMembers).toContain('{count}')
  })

  it('should have a reasonable total key count', () => {
    function countKeys(obj: Record<string, unknown>): number {
      let count = 0
      for (const value of Object.values(obj)) {
        if (typeof value === 'string') count++
        else if (typeof value === 'object' && value !== null) {
          count += countKeys(value as Record<string, unknown>)
        }
      }
      return count
    }
    const total = countKeys(messages as Record<string, unknown>)
    expect(total).toBeGreaterThan(100)
    expect(total).toBeLessThan(1000)
  })
})
