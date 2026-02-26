import { Resend } from 'resend'
import { createServiceClient } from './supabase'

export interface EmailNotificationPayload {
  userId: string
  studioId: string
  type: string
  title: string
  body: string
}

export interface DirectEmailPayload {
  to: string
  subject: string
  html: string
  text: string
  attachments?: Array<{ filename: string; content: string; contentType: string }>
}

let _resend: Resend | null = null

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!_resend) _resend = new Resend(apiKey)
  return _resend
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function wrapHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escHtml(title)}</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin-bottom:8px">${escHtml(title)}</h1>
  ${content}
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0">
  <p style="color:#888;font-size:12px">Studio Co-op · You're receiving this because you have an account at studio.coop.</p>
</body>
</html>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TEMPLATES: Record<string, (body: string) => { html: string; text: string }> = {
  booking_confirmed: (body) => ({
    html: wrapHtml('Booking Confirmed', `<p>${escHtml(body)}</p><p>See you in class!</p>`),
    text: `Booking Confirmed\n\n${body}\n\nSee you in class!`,
  }),
  class_reminder_24h: (body) => ({
    html: wrapHtml('Class Tomorrow', `<p>${escHtml(body)}</p><p>We'll see you there!</p>`),
    text: `Class Tomorrow\n\n${body}\n\nWe'll see you there!`,
  }),
  class_reminder_2h: (body) => ({
    html: wrapHtml('Class Starting Soon', `<p>${escHtml(body)}</p><p>Get ready!</p>`),
    text: `Class Starting Soon\n\n${body}\n\nGet ready!`,
  }),
  waitlist_promoted: (body) => ({
    html: wrapHtml('You\'re In! 🎉', `<p>Great news — a spot opened up for you!</p><p>${escHtml(body)}</p>`),
    text: `You're In!\n\nGreat news — a spot opened up for you!\n\n${body}`,
  }),
  payment_receipt: (body) => ({
    html: wrapHtml('Payment Receipt', `<p>${escHtml(body)}</p><p>Thank you for your payment.</p>`),
    text: `Payment Receipt\n\n${body}\n\nThank you for your payment.`,
  }),
  welcome: (body) => ({
    html: wrapHtml('Welcome to Studio Co-op!', `<p>${escHtml(body)}</p><p>We're excited to have you.</p>`),
    text: `Welcome to Studio Co-op!\n\n${body}\n\nWe're excited to have you.`,
  }),
  reengagement: (body) => ({
    html: wrapHtml('We Miss You!', `<p>${escHtml(body)}</p><p>Come back and book a class today.</p>`),
    text: `We Miss You!\n\n${body}\n\nCome back and book a class today.`,
  }),
  class_cancelled: (body) => ({
    html: wrapHtml('Class Cancelled', `<p>${escHtml(body)}</p><p>We apologise for the inconvenience.</p>`),
    text: `Class Cancelled\n\n${body}\n\nWe apologise for the inconvenience.`,
  }),
}

function getTemplate(type: string, body: string): { html: string; text: string } {
  const tpl = TEMPLATES[type]
  if (tpl) return tpl(body)
  // Generic fallback
  return {
    html: wrapHtml(type.replace(/_/g, ' '), `<p>${escHtml(body)}</p>`),
    text: `${type}\n\n${body}`,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an email notification to a user via Resend.
 * Fetches the user's email address from the DB.
 * No-op if RESEND_API_KEY is not configured.
 */
export async function sendEmailForNotification(payload: EmailNotificationPayload): Promise<void> {
  const resend = getResendClient()
  if (!resend) return  // not configured

  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', payload.userId)
    .single()

  if (!user?.email) return

  const { html, text } = getTemplate(payload.type, payload.body)
  const fromAddress = process.env.EMAIL_FROM ?? 'noreply@studio.coop'

  await resend.emails.send({
    from: fromAddress,
    to: [user.email],
    subject: payload.title,
    html,
    text,
  })
}

/**
 * Send a raw email directly (for custom use cases like payment receipts with attachments).
 */
export async function sendEmail(payload: DirectEmailPayload): Promise<void> {
  const resend = getResendClient()
  if (!resend) return

  const fromAddress = process.env.EMAIL_FROM ?? 'noreply@studio.coop'

  await resend.emails.send({
    from: fromAddress,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content),
      contentType: a.contentType,
    })),
  })
}
