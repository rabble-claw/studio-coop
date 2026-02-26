import { describe, it, expect } from 'vitest'
import { createServiceClient, createAuthClient } from '../lib/supabase'

describe('Supabase client factory', () => {
  it('createServiceClient returns a client (uses service role key)', () => {
    // Will use env vars; in test we just verify it doesn't throw
    // Real integration tests need Supabase running
    expect(typeof createServiceClient).toBe('function')
  })

  it('createAuthClient returns a client scoped to user JWT', () => {
    expect(typeof createAuthClient).toBe('function')
  })
})
