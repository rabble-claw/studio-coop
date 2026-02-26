import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkBookingCredits, deductCredit, refundCredit } from '../lib/credits'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '../lib/supabase'

const USER_ID = 'user-123'
const STUDIO_ID = 'studio-abc'

function makeSupabaseMock({
  compClasses = [],
  subscription = null as unknown,
  classPasses = [],
}: {
  compClasses?: unknown[]
  subscription?: unknown
  classPasses?: unknown[]
}) {
  let fromCallCount = 0
  const tableResponses: Record<string, unknown> = {
    comp_classes: { data: compClasses, error: null },
    subscriptions: { data: subscription, error: null },
    class_passes: { data: classPasses, error: null },
  }

  // Track which table was last queried
  let currentTable = ''

  const chain = {
    from: vi.fn((table: string) => {
      currentTable = table
      return chain
    }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ error: null }),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve(tableResponses[currentTable] ?? { data: null, error: null })
    ),
    // For comp_classes and class_passes which return arrays via implicit resolution
    // We make the chain itself resolve as the response
    then: undefined as unknown,
  }

  // Make the chain thenable for table queries that don't end in .single()/.maybeSingle()
  // (i.e., queries that just await the chain directly)
  const makeResolvable = (tableName: string) => {
    const resp = tableResponses[tableName] ?? { data: null, error: null }
    const c = {
      from: vi.fn((table: string) => {
        currentTable = table
        return makeResolvable(table)
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      rpc: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue(resp),
      [Symbol.toStringTag]: 'Promise',
    }
    // Make it awaitable
    Object.defineProperty(c, 'then', {
      get: () => (res: (v: unknown) => void) => Promise.resolve(resp).then(res),
    })
    Object.defineProperty(c, 'catch', {
      get: () => (rej: (e: unknown) => void) => Promise.resolve(resp).catch(rej),
    })
    return c
  }

  return {
    from: vi.fn((table: string) => {
      currentTable = table
      return makeResolvable(table)
    }),
    rpc: vi.fn().mockResolvedValue({ error: null }),
  }
}

describe('checkBookingCredits — priority ordering', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('uses comp class first when available', async () => {
    const now = new Date()
    const futureExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const mock = makeSupabaseMock({
      compClasses: [{ id: 'comp-1', remaining_classes: 2, expires_at: futureExpiry }],
      subscription: { id: 'sub-1', plan_id: 'plan-1', status: 'active', classes_used_this_period: 0, plan: { type: 'unlimited', class_limit: null } },
      classPasses: [{ id: 'pass-1', remaining_classes: 5, expires_at: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.source).toBe('comp_class')
    expect(result.hasCredits).toBe(true)
    expect(result.sourceId).toBe('comp-1')
    expect(result.remainingAfter).toBe(1)
  })

  it('uses unlimited subscription when no comp class', async () => {
    const mock = makeSupabaseMock({
      compClasses: [],
      subscription: { id: 'sub-1', plan_id: 'plan-1', status: 'active', classes_used_this_period: 0, plan: { type: 'unlimited', class_limit: null } },
      classPasses: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.source).toBe('subscription_unlimited')
    expect(result.hasCredits).toBe(true)
  })

  it('uses limited subscription when classes remain this period', async () => {
    const mock = makeSupabaseMock({
      compClasses: [],
      subscription: { id: 'sub-1', plan_id: 'plan-1', status: 'active', classes_used_this_period: 3, plan: { type: 'limited', class_limit: 8 } },
      classPasses: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.source).toBe('subscription_limited')
    expect(result.remainingAfter).toBe(4) // 8 - 3 - 1
  })

  it('skips limited subscription when limit reached, falls to class pack', async () => {
    const mock = makeSupabaseMock({
      compClasses: [],
      subscription: { id: 'sub-1', plan_id: 'plan-1', status: 'active', classes_used_this_period: 8, plan: { type: 'limited', class_limit: 8 } },
      classPasses: [{ id: 'pass-1', remaining_classes: 3, expires_at: null }],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.source).toBe('class_pack')
    expect(result.sourceId).toBe('pass-1')
    expect(result.remainingAfter).toBe(2)
  })

  it('returns none when user has no credits', async () => {
    const mock = makeSupabaseMock({
      compClasses: [],
      subscription: null,
      classPasses: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.hasCredits).toBe(false)
    expect(result.source).toBe('none')
  })

  it('skips expired comp class and tries next source', async () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString()
    const mock = makeSupabaseMock({
      compClasses: [{ id: 'comp-expired', remaining_classes: 1, expires_at: pastExpiry }],
      subscription: { id: 'sub-1', plan_id: 'plan-1', status: 'active', classes_used_this_period: 0, plan: { type: 'unlimited', class_limit: null } },
      classPasses: [],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.source).toBe('subscription_unlimited')
  })

  it('skips expired class packs', async () => {
    const pastExpiry = new Date(Date.now() - 1000).toISOString()
    const mock = makeSupabaseMock({
      compClasses: [],
      subscription: null,
      classPasses: [{ id: 'pass-expired', remaining_classes: 3, expires_at: pastExpiry }],
    })
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    const result = await checkBookingCredits(USER_ID, STUDIO_ID)
    expect(result.hasCredits).toBe(false)
    expect(result.source).toBe('none')
  })
})

describe('deductCredit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does nothing when source is none', async () => {
    const mock = makeSupabaseMock({})
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await deductCredit({ hasCredits: false, source: 'none' })
    expect(mock.from).not.toHaveBeenCalled()
  })

  it('decrements remaining_classes for comp_class', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mock = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await deductCredit({ hasCredits: true, source: 'comp_class', sourceId: 'comp-1', remainingAfter: 1 })
    expect(updateMock).toHaveBeenCalledWith({ remaining_classes: 1 })
  })

  it('calls rpc increment for limited subscription', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const mock = { from: vi.fn(), rpc: rpcMock }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await deductCredit({ hasCredits: true, source: 'subscription_limited', sourceId: 'sub-1', remainingAfter: 4 })
    expect(rpcMock).toHaveBeenCalledWith('increment_classes_used', { subscription_id: 'sub-1' })
  })

  it('decrements remaining_classes for class_pack', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mock = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await deductCredit({ hasCredits: true, source: 'class_pack', sourceId: 'pass-1', remainingAfter: 2 })
    expect(updateMock).toHaveBeenCalledWith({ remaining_classes: 2 })
  })

  it('does nothing for unlimited subscription', async () => {
    const mock = { from: vi.fn(), rpc: vi.fn() }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await deductCredit({ hasCredits: true, source: 'subscription_unlimited', sourceId: 'sub-1' })
    expect(mock.from).not.toHaveBeenCalled()
    expect(mock.rpc).not.toHaveBeenCalled()
  })
})

describe('refundCredit', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('restores remaining_classes for comp_class', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mock = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    // remainingAfter was 1 at deduct time; refund should restore to 2
    await refundCredit({ hasCredits: true, source: 'comp_class', sourceId: 'comp-1', remainingAfter: 1 })
    expect(updateMock).toHaveBeenCalledWith({ remaining_classes: 2 })
  })

  it('calls rpc decrement for limited subscription', async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null })
    const mock = { from: vi.fn(), rpc: rpcMock }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await refundCredit({ hasCredits: true, source: 'subscription_limited', sourceId: 'sub-1', remainingAfter: 4 })
    expect(rpcMock).toHaveBeenCalledWith('decrement_classes_used', { subscription_id: 'sub-1' })
  })

  it('restores remaining_classes for class_pack', async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    const mock = {
      from: vi.fn().mockReturnValue({ update: updateMock }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await refundCredit({ hasCredits: true, source: 'class_pack', sourceId: 'pass-1', remainingAfter: 2 })
    expect(updateMock).toHaveBeenCalledWith({ remaining_classes: 3 })
  })
})
