import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/supabase', () => ({ createServiceClient: vi.fn() }))

// Shared spy so we can inspect calls regardless of how many Resend instances are created
const sendSpy = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null })

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendSpy } })),
}))

import { createServiceClient } from '../lib/supabase'

function makeUserMock(email: string | null = 'test@example.com') {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { email, name: 'Test' }, error: null }),
        }),
      }),
    }),
  }
}

describe('sendEmailForNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendSpy.mockClear()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('no-ops when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY
    vi.resetModules()
    const { sendEmailForNotification } = await import('../lib/email')
    const mock = makeUserMock()
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await sendEmailForNotification({ userId: 'u1', studioId: 's1', type: 'booking_confirmed', title: 'T', body: 'B' })

    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('fetches user email and sends via Resend', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmailForNotification } = await import('../lib/email')
    const mock = makeUserMock('alice@example.com')
    vi.mocked(createServiceClient).mockReturnValue(mock as any)

    await sendEmailForNotification({
      userId: 'u1', studioId: 's1', type: 'booking_confirmed',
      title: 'Booking Confirmed', body: 'Your class is confirmed!',
    })

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['alice@example.com'],
        subject: 'Booking Confirmed',
        html: expect.stringContaining('Booking Confirmed'),
        text: expect.stringContaining('Your class is confirmed!'),
      }),
    )
  })

  it('booking_confirmed template includes confirmation copy', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmailForNotification } = await import('../lib/email')
    vi.mocked(createServiceClient).mockReturnValue(makeUserMock() as any)

    await sendEmailForNotification({ userId: 'u1', studioId: 's1', type: 'booking_confirmed', title: 'T', body: 'See you at 9am' })

    const call = sendSpy.mock.calls.at(-1)?.[0]
    expect(call?.html).toContain('See you in class!')
  })

  it('reengagement template includes "We Miss You" heading', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmailForNotification } = await import('../lib/email')
    vi.mocked(createServiceClient).mockReturnValue(makeUserMock() as any)

    await sendEmailForNotification({ userId: 'u1', studioId: 's1', type: 'reengagement', title: 'We miss you', body: 'Come back!' })

    const call = sendSpy.mock.calls.at(-1)?.[0]
    expect(call?.html).toContain('We Miss You')
  })

  it('unknown type uses generic fallback template', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmailForNotification } = await import('../lib/email')
    vi.mocked(createServiceClient).mockReturnValue(makeUserMock() as any)

    await sendEmailForNotification({ userId: 'u1', studioId: 's1', type: 'custom_event', title: 'Custom', body: 'Details here' })

    const call = sendSpy.mock.calls.at(-1)?.[0]
    expect(call?.html).toContain('Details here')
  })

  it('no-ops when user has no email address', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmailForNotification } = await import('../lib/email')
    vi.mocked(createServiceClient).mockReturnValue(makeUserMock(null) as any)

    await sendEmailForNotification({ userId: 'u1', studioId: 's1', type: 'booking_confirmed', title: 'T', body: 'B' })

    expect(sendSpy).not.toHaveBeenCalled()
  })
})

describe('sendEmail (direct)', () => {
  beforeEach(() => {
    sendSpy.mockClear()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('sends directly with provided fields', async () => {
    vi.resetModules()
    process.env.RESEND_API_KEY = 'test-key'
    const { sendEmail } = await import('../lib/email')

    await sendEmail({ to: 'owner@example.com', subject: 'Receipt', html: '<p>Paid</p>', text: 'Paid' })

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['owner@example.com'], subject: 'Receipt' }),
    )
  })
})
