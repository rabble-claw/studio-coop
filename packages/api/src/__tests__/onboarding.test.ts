import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeRetentionScore } from '../lib/retention'
import { ONBOARDING_STEPS } from '../lib/onboarding'

// Mock dependencies before importing the module under test
vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/notifications', () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}))

import { createServiceClient } from '../lib/supabase'
import { sendNotification } from '../lib/notifications'
import { startOnboarding, advanceOnboarding } from '../lib/onboarding'

function makeMockSupabase(overrides: Record<string, any> = {}) {
  const defaultChain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  defaultChain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
  defaultChain.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)
  defaultChain[Symbol.toStringTag] = 'Promise'

  return {
    from: vi.fn((table: string) => {
      if (overrides[table]) return overrides[table]
      return defaultChain
    }),
  }
}

describe('ONBOARDING_STEPS', () => {
  it('has 6 steps in correct order', () => {
    expect(ONBOARDING_STEPS).toHaveLength(6)
    expect(ONBOARDING_STEPS[0].name).toBe('welcome')
    expect(ONBOARDING_STEPS[1].name).toBe('class_recommendation')
    expect(ONBOARDING_STEPS[2].name).toBe('first_class_followup')
    expect(ONBOARDING_STEPS[3].name).toBe('social_prompt')
    expect(ONBOARDING_STEPS[4].name).toBe('progress_check')
    expect(ONBOARDING_STEPS[5].name).toBe('milestone')
  })

  it('has increasing delays', () => {
    for (let i = 1; i < ONBOARDING_STEPS.length; i++) {
      expect(ONBOARDING_STEPS[i].delay).toBeGreaterThanOrEqual(ONBOARDING_STEPS[i - 1].delay)
    }
  })
})

describe('startOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts sequence and sends welcome notification', async () => {
    const existingChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }

    const insertChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    // First call: check existing (maybeSingle), second call: insert
    let callCount = 0
    const mock = {
      from: vi.fn(() => {
        callCount++
        if (callCount === 1) return existingChain
        return insertChain
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mock)

    await startOnboarding('studio-1', 'user-1')

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        studioId: 'studio-1',
        type: 'onboarding_welcome',
      })
    )
  })

  it('skips if sequence already exists', async () => {
    const existingChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'seq-1' } }),
    }

    ;(createServiceClient as any).mockReturnValue({
      from: vi.fn(() => existingChain),
    })

    await startOnboarding('studio-1', 'user-1')

    expect(sendNotification).not.toHaveBeenCalled()
  })
})

describe('advanceOnboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not advance if delay not met', async () => {
    const mock = makeMockSupabase()
    ;(createServiceClient as any).mockReturnValue(mock)

    // Step 0, started 0 days ago — next step (1) needs 1 day
    const now = new Date()
    const result = await advanceOnboarding('studio-1', 'user-1', 0, now.toISOString())

    expect(result.advanced).toBe(false)
    expect(result.completed).toBe(false)
  })

  it('advances to next step when delay is met', async () => {
    const attendanceChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 0 }),
    }

    const updateChain: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    updateChain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
    updateChain.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)
    updateChain[Symbol.toStringTag] = 'Promise'

    const mock = makeMockSupabase({
      attendance: attendanceChain,
      onboarding_sequences: updateChain,
    })
    ;(createServiceClient as any).mockReturnValue(mock)

    // Step 0, started 2 days ago — step 1 needs 1 day delay
    const twoDAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    const result = await advanceOnboarding('studio-1', 'user-1', 0, twoDAgo.toISOString())

    expect(result.advanced).toBe(true)
    expect(result.newStep).toBe(1)
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'onboarding_class_recommendation',
      })
    )
  })

  it('skips first_class_followup if member attended 3+ classes', async () => {
    const attendanceChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 5 }),
    }

    const feedChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ count: 0 }),
    }

    const updateChain: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    updateChain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
    updateChain.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)
    updateChain[Symbol.toStringTag] = 'Promise'

    let callCount = 0
    const mock = {
      from: vi.fn((table: string) => {
        if (table === 'attendance') return attendanceChain
        if (table === 'feed_posts') return feedChain
        if (table === 'onboarding_sequences') return updateChain
        return updateChain
      }),
    }
    ;(createServiceClient as any).mockReturnValue(mock)

    // Step 1 (class_recommendation), started 8 days ago — step 2 needs 3 days
    const eightDAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    const result = await advanceOnboarding('studio-1', 'user-1', 1, eightDAgo.toISOString())

    // Should skip step 2 (first_class_followup) and go to step 3 (social_prompt)
    expect(result.advanced).toBe(true)
    expect(result.newStep).toBe(3)
    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'onboarding_social_prompt',
      })
    )
  })

  it('marks completed after final step', async () => {
    const updateChain: any = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    updateChain.then = (res: any) => Promise.resolve({ data: null, error: null }).then(res)
    updateChain.catch = (rej: any) => Promise.resolve({ data: null, error: null }).catch(rej)
    updateChain[Symbol.toStringTag] = 'Promise'

    ;(createServiceClient as any).mockReturnValue({
      from: vi.fn(() => updateChain),
    })

    // Step 5 is the last step — advancing past it should complete
    const thirtyDAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
    const result = await advanceOnboarding('studio-1', 'user-1', 5, thirtyDAgo.toISOString())

    expect(result.completed).toBe(true)
  })
})
