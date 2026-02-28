import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendNotification } from '../lib/notifications'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))
vi.mock('../lib/push', () => ({ sendPushNotification: vi.fn() }))
vi.mock('../lib/email', () => ({ sendEmailForNotification: vi.fn() }))

import { createServiceClient } from '../lib/supabase'
import { sendPushNotification } from '../lib/push'
import { sendEmailForNotification } from '../lib/email'

function makeSupabaseMock(notifId = 'notif-1', insertError: Error | null = null) {
  const updateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  }
  const selectChain = {
    single: vi.fn().mockResolvedValue(
      insertError
        ? { data: null, error: insertError }
        : { data: { id: notifId }, error: null },
    ),
  }
  const notificationsResult = {
    insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(selectChain) }),
    update: vi.fn().mockReturnValue(updateChain),
  }
  // notification_preferences query chain (getUserPrefs)
  const prefsResult = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }
  return {
    from: vi.fn().mockImplementation((table: string) =>
      table === 'notification_preferences' ? prefsResult : notificationsResult,
    ),
  }
}

const basePayload = {
  userId: 'user-1',
  studioId: 'studio-1',
  type: 'booking_confirmed',
  title: 'Booking Confirmed',
  body: 'Your class is confirmed!',
}

describe('sendNotification', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('creates a DB record and updates sent_at for in_app channel', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await sendNotification({ ...basePayload, channels: ['in_app'] })

    expect(mock.from).toHaveBeenCalledWith('notifications')
    // Results: [0]=notification_preferences, [1]=notifications insert, [2]=notifications update
    const fromResult = mock.from.mock.results[1].value
    expect(fromResult.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', type: 'booking_confirmed' }),
    )
    // sent_at update (prefs + insert + update = 3 calls)
    expect(mock.from).toHaveBeenCalledTimes(3)
    const updateResult = mock.from.mock.results[2].value
    expect(updateResult.update).toHaveBeenCalledWith(
      expect.objectContaining({ sent_at: expect.any(String) }),
    )
  })

  it('dispatches push channel when requested', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(sendPushNotification).mockResolvedValue()

    await sendNotification({ ...basePayload, channels: ['push', 'in_app'] })

    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', title: 'Booking Confirmed' }),
    )
  })

  it('dispatches email channel when requested', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(sendEmailForNotification).mockResolvedValue()

    await sendNotification({ ...basePayload, channels: ['email', 'in_app'] })

    expect(sendEmailForNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', type: 'booking_confirmed' }),
    )
  })

  it('dispatches multiple channels in one call', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(sendPushNotification).mockResolvedValue()
    vi.mocked(sendEmailForNotification).mockResolvedValue()

    await sendNotification({ ...basePayload, channels: ['push', 'email', 'in_app'] })

    expect(sendPushNotification).toHaveBeenCalledTimes(1)
    expect(sendEmailForNotification).toHaveBeenCalledTimes(1)
  })

  it('throws when DB insert fails', async () => {
    const mock = makeSupabaseMock('notif-1', new Error('DB error'))
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await expect(
      sendNotification({ ...basePayload, channels: ['in_app'] }),
    ).rejects.toThrow('Failed to create notification record')
  })

  it('does not throw when a channel dispatch fails — still updates sent_at', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(sendPushNotification).mockRejectedValue(new Error('Expo unavailable'))

    await expect(
      sendNotification({ ...basePayload, channels: ['push', 'in_app'] }),
    ).resolves.toBeUndefined()

    // sent_at still updated (prefs + insert + update = 3 calls)
    expect(mock.from).toHaveBeenCalledTimes(3)
  })

  it('passes data payload through to push', async () => {
    const mock = makeSupabaseMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)
    vi.mocked(sendPushNotification).mockResolvedValue()

    await sendNotification({
      ...basePayload,
      data: { classId: 'class-123', screen: 'BookingDetail' },
      channels: ['push'],
    })

    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: 'class-123', screen: 'BookingDetail' } }),
    )
  })
})
