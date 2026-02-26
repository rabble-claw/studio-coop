# Notifications — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Multi-channel notifications: push, email, in-app. Reminders, confirmations, waitlist promotions, re-engagement.

**Architecture:** Notification service with pluggable channels. Scheduled jobs for time-based notifications. Templates for consistent messaging.

**Tech Stack:** Expo Notifications (push), Resend (email), Hono, Supabase

**Depends on:** Plan 1, 2

---

### Task 1: Notification service core

Create `packages/api/src/lib/notifications.ts`:

```typescript
interface NotificationPayload {
  userId: string
  studioId: string
  type: string  // 'booking_confirmed', 'class_reminder_24h', 'waitlist_promoted', etc.
  title: string
  body: string
  data?: Record<string, string>  // deep link info
  channels: ('push' | 'email' | 'in_app')[]
}

async function sendNotification(payload: NotificationPayload): Promise<void>
```

Flow:
1. Create `notifications` DB record
2. For each channel, dispatch to channel-specific sender
3. Update `sent_at` on success

**Tests:** Record creation, multi-channel dispatch, failure handling.

---

### Task 2: Push notifications (Expo)

Create `packages/api/src/lib/push.ts`:

- Add `push_tokens` table: `id, user_id, token text, platform (ios/android), created_at`
- `POST /api/my/push-token` — register device token
- `DELETE /api/my/push-token` — unregister
- Send via Expo Push API (`expo-server-sdk`)

Mobile app: register token on login, unregister on logout.

**Tests:** Token registration, Expo API call format, token cleanup.

---

### Task 3: Email notifications (Resend)

Create `packages/api/src/lib/email.ts`:

- Use Resend SDK with `RESEND_API_KEY`
- From address: `noreply@studio.coop` (or studio-specific if custom domain)
- Templates for each notification type (HTML + plain text)

Email types:
- Booking confirmation (with iCal attachment)
- Class reminder
- Waitlist promotion
- Payment receipt
- Welcome / onboarding
- Re-engagement ("We miss you!")

**Tests:** Template rendering, Resend API call format.

---

### Task 4: In-app notification center

API:
- `GET /api/my/notifications?unread=true` — list notifications
- `POST /api/my/notifications/:id/read` — mark read
- `POST /api/my/notifications/read-all` — mark all read
- `GET /api/my/notifications/count` — unread count (for badge)

Web: notification bell icon in dashboard header with dropdown.
Mobile: notifications tab or bell icon.

**Tests:** Unread filtering, mark read, count.

---

### Task 5: Scheduled notification jobs

Cron jobs that run periodically:

**Class reminders (every hour):**
- Find bookings where class starts in 24±0.5h → send 24h reminder
- Find bookings where class starts in 2±0.5h → send 2h reminder
- Skip if already sent (check `notifications` table)

**Re-engagement (daily):**
- Find members who haven't booked in 14+ days
- Send "We miss you!" with studio's next available classes
- Respect studio's `settings.reengagementEnabled`

**Class generation (daily):**
- Run `generateClassInstances` for all active studios

**Tests:** Window calculation, duplicate prevention, timezone handling.

---

### Task 6: Studio notification settings

Add to `studios.settings`:
```json
{
  "notifications": {
    "reminderHours": [24, 2],
    "confirmationEnabled": true,
    "reengagementEnabled": true,
    "reengagementDays": 14,
    "feedNotifications": true
  }
}
```

`GET /api/studios/:studioId/settings/notifications` — get settings
`PUT /api/studios/:studioId/settings/notifications` — update (owner only)

**Tests:** Settings CRUD, defaults for new studios.

---

### Task 7: Member notification preferences

Add `notification_preferences` table or field on memberships:
```json
{
  "push": true,
  "email": true,
  "reminders": true,
  "feed": true,
  "marketing": false
}
```

`GET /api/my/notification-preferences` — get
`PUT /api/my/notification-preferences` — update

Notification service checks preferences before sending.

**Tests:** Preference enforcement, opt-out respected.
