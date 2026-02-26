# Booking & Waitlist Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the core booking flow — the heart of the app. Members book classes, credits are deducted, waitlists auto-promote, and reminders go out.

**Architecture:** Transactional booking API with pessimistic locking to prevent overbooking. Waitlist promotion runs as a triggered side-effect when cancellations happen.

**Tech Stack:** Hono, Supabase (with row-level locking), Zod

**Depends on:** Plan 1, 2, 4 (credits system)

---

### Task 1: Book a class

Create `packages/api/src/routes/bookings.ts`:

`POST /api/classes/:classId/book`

Flow (must be atomic):
1. Check class exists and is `scheduled`
2. Check user is member of the studio
3. Check user doesn't already have a booking for this class
4. Count current non-cancelled bookings vs `max_capacity`
5. If full → add to waitlist (see Task 3)
6. If available → check credits (`checkBookingCredits`)
7. If has credits → deduct and create booking with status `booked`
8. If no credits → return error with redirect to purchase options
9. Generate iCal invite and return it

Use `SELECT ... FOR UPDATE` on class_instances to prevent race conditions.

**Tests:** Happy path, already booked, class full → waitlist, no credits, capacity race condition.

---

### Task 2: Cancel a booking

`DELETE /api/bookings/:bookingId`

Flow:
1. Verify booking belongs to user
2. Check cancellation window (studio's `settings.cancellationWindowHours`)
3. If within window → mark as cancelled, refund credit
4. If outside window → mark as cancelled, optionally charge late-cancel fee (future)
5. If there's a waitlist → trigger promotion (Task 3)
6. Cancel calendar invite

**Tests:** Successful cancel, late cancel, credit refund, waitlist trigger.

---

### Task 3: Waitlist engine

When class is full:
- `POST /api/classes/:classId/book` creates booking with `status = 'waitlisted'`, assigns `waitlist_position`

When a spot opens (cancellation or capacity increase):
1. Find first waitlisted booking by position
2. Check they still have credits
3. If yes → promote to `booked`, deduct credit, send notification
4. If no → skip, try next
5. Send push notification: "A spot opened up in [Class] — you're in!"

Create `packages/api/src/lib/waitlist.ts` with:
- `addToWaitlist(classId, userId)` 
- `promoteFromWaitlist(classId)` — called after cancellation
- `getWaitlistPosition(classId, userId)`

**Tests:** Waitlist ordering, promotion, skip-if-no-credits, notification trigger.

---

### Task 4: Confirmation flow

24h before class: send push notification "Still coming to [Class] tomorrow at [time]?"
2h before class: send reminder "Your class starts in 2 hours!"

`POST /api/bookings/:bookingId/confirm` — marks `confirmed_at`, updates status to `confirmed`

Implementation:
- Confirmation check runs as a cron/scheduled function
- Queries bookings where class date is within reminder window
- Sends push notification with deep link to confirm
- If not confirmed by class time → still counted as booked (not auto-cancelled)

**Tests:** Reminder window calculation, confirm endpoint, timezone handling.

---

### Task 5: Calendar invite generation

Create `packages/api/src/lib/calendar.ts`:

Generate iCal (.ics) content for:
- Booking confirmation
- Booking cancellation (CANCEL method)
- Class update (teacher change, time change)

Include: event title, time (with studio timezone), location, description, organizer (studio).

Return as downloadable attachment or embed in confirmation email.

**Tests:** Valid iCal output, timezone correctness, cancel method.

---

### Task 6: My bookings endpoint

`GET /api/my/bookings` — list all upcoming bookings for authenticated user, across all studios

Response includes:
- Class name, date, time, teacher, studio
- Booking status (booked, confirmed, waitlisted)
- Waitlist position if applicable
- Cancel deadline

**Tests:** Cross-studio listing, correct status display, past bookings filtered out.

---

### Task 7: Staff booking management

`GET /api/classes/:classId/bookings` — staff view of all bookings for a class

Includes:
- Member name, avatar, booking status
- Waitlist with positions
- Booking/confirmation times

`POST /api/classes/:classId/bookings` — staff can book a member into a class (bypasses credit check)
`DELETE /api/classes/:classId/bookings/:bookingId` — staff can cancel any booking

**Tests:** Staff-only access, bypass credit check for staff bookings.
