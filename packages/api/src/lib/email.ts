export interface EmailNotificationPayload {
  userId: string
  studioId: string
  type: string
  title: string
  body: string
}

/**
 * Send an email notification to a user via Resend.
 * No-op if RESEND_API_KEY is not configured.
 * Implemented in Task 3.
 */
export async function sendEmailForNotification(_payload: EmailNotificationPayload): Promise<void> {
  // Implemented in Task 3
}
