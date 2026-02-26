import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getConfig } from '../lib/config'

const VALID_ENV = {
  SUPABASE_URL: 'https://xyz.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-123',
  SUPABASE_ANON_KEY: 'anon-key-456',
  STRIPE_SECRET_KEY: 'sk_test_abc123',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PLATFORM_FEE_PERCENT: undefined as string | undefined,
  WEB_URL: undefined as string | undefined,
}

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = val
    }
  }
}

let saved: Record<string, string | undefined> = {}

beforeEach(() => {
  // Save and set valid baseline
  saved = {}
  for (const key of Object.keys(VALID_ENV)) {
    saved[key] = process.env[key]
  }
  setEnv(VALID_ENV)
})

afterEach(() => {
  setEnv(saved)
})

describe('getConfig', () => {
  it('returns parsed config when all required vars are set', () => {
    const config = getConfig()
    expect(config.SUPABASE_URL).toBe('https://xyz.supabase.co')
    expect(config.STRIPE_SECRET_KEY).toBe('sk_test_abc123')
    expect(config.STRIPE_WEBHOOK_SECRET).toBe('whsec_test_secret')
    expect(config.STRIPE_PLATFORM_FEE_PERCENT).toBe(2.5)
    expect(['development', 'test', 'production']).toContain(config.NODE_ENV)
  })

  it('uses custom platform fee percent when set', () => {
    setEnv({ STRIPE_PLATFORM_FEE_PERCENT: '5' })
    const config = getConfig()
    expect(config.STRIPE_PLATFORM_FEE_PERCENT).toBe(5)
  })

  it('throws when STRIPE_SECRET_KEY is missing', () => {
    setEnv({ STRIPE_SECRET_KEY: undefined })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when STRIPE_SECRET_KEY does not start with sk_', () => {
    setEnv({ STRIPE_SECRET_KEY: 'pk_live_wrong' })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when STRIPE_WEBHOOK_SECRET does not start with whsec_', () => {
    setEnv({ STRIPE_WEBHOOK_SECRET: 'bad_secret' })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when SUPABASE_URL is not a valid URL', () => {
    setEnv({ SUPABASE_URL: 'not-a-url' })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('throws when fee percent is out of range', () => {
    setEnv({ STRIPE_PLATFORM_FEE_PERCENT: '75' })
    expect(() => getConfig()).toThrow('Invalid environment configuration')
  })

  it('WEB_URL is optional — omitting it does not throw', () => {
    setEnv({ WEB_URL: undefined })
    expect(() => getConfig()).not.toThrow()
    const config = getConfig()
    expect(config.WEB_URL).toBeUndefined()
  })
})
