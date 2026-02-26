import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendPushNotification, registerPushToken, unregisterPushToken } from '../lib/push'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('expo-server-sdk', () => {
  const Expo = vi.fn().mockImplementation(() => ({
    chunkPushNotifications: vi.fn((msgs: unknown[]) => [msgs]),
    sendPushNotificationsAsync: vi.fn().mockResolvedValue([{ status: 'ok' }]),
  }))
  Expo.isExpoPushToken = vi.fn().mockReturnValue(true)
  return { default: Expo }
})

import { createServiceClient } from '../lib/supabase'
import Expo from 'expo-server-sdk'

function makeSupabaseMock(tokens: { id: string; token: string }[] = []) {
  const deleteChain = { in: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn() }
  deleteChain.eq = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
  const upsertChain = vi.fn().mockResolvedValue({ error: null })
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'push_tokens') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: tokens, error: null }),
          }),
          upsert: upsertChain,
          delete: vi.fn().mockReturnValue(deleteChain),
        }
      }
      return {}
    }),
  }
}

describe('sendPushNotification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('no-ops when user has no tokens', async () => {
    const mock = makeSupabaseMock([])
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await sendPushNotification({ userId: 'u1', title: 'Hi', body: 'Test' })

    // expo sendPushNotificationsAsync should not be called
    const expoInstance = vi.mocked(Expo).mock.results[0]?.value
    if (expoInstance) {
      expect(expoInstance.sendPushNotificationsAsync).not.toHaveBeenCalled()
    }
  })

  it('sends to valid Expo tokens', async () => {
    const tokens = [{ id: 'tok-1', token: 'ExponentPushToken[xxx]' }]
    const mock = makeSupabaseMock(tokens)
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(Expo.isExpoPushToken).mockReturnValue(true)

    await sendPushNotification({ userId: 'u1', title: 'Reminder', body: 'Class soon!' })

    const expoInstance = vi.mocked(Expo).mock.results[0]?.value
    expect(expoInstance.sendPushNotificationsAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ to: 'ExponentPushToken[xxx]', title: 'Reminder' }),
      ]),
    )
  })

  it('filters out non-Expo tokens', async () => {
    const tokens = [{ id: 'tok-1', token: 'not-a-valid-token' }]
    const mock = makeSupabaseMock(tokens)
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(Expo.isExpoPushToken).mockReturnValue(false)

    await sendPushNotification({ userId: 'u1', title: 'Hi', body: 'Test' })

    const expoInstance = vi.mocked(Expo).mock.results[0]?.value
    if (expoInstance) {
      expect(expoInstance.sendPushNotificationsAsync).not.toHaveBeenCalled()
    }
  })
})

describe('registerPushToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('upserts token into push_tokens table', async () => {
    const upsertFn = vi.fn().mockResolvedValue({ error: null })
    const mock = {
      from: vi.fn().mockReturnValue({ upsert: upsertFn }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await registerPushToken({ userId: 'u1', token: 'ExponentPushToken[abc]', platform: 'ios' })

    expect(upsertFn).toHaveBeenCalledWith(
      { user_id: 'u1', token: 'ExponentPushToken[abc]', platform: 'ios' },
      { onConflict: 'user_id,token' },
    )
  })
})

describe('unregisterPushToken', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('deletes token from push_tokens table', async () => {
    const eqChain = { eq: vi.fn().mockResolvedValue({ error: null }) }
    const deleteFn = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue(eqChain) })
    const mock = {
      from: vi.fn().mockReturnValue({ delete: deleteFn }),
    }
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await unregisterPushToken('u1', 'ExponentPushToken[abc]')

    expect(deleteFn).toHaveBeenCalled()
  })
})
