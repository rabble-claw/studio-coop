# Check-in & Attendance — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable teachers to check in students via a fast photo-grid UI. Complete attendance in under 30 seconds.

**Architecture:** Batch check-in API. Photo grid component shared between web and mobile.

**Tech Stack:** Hono, React (web), React Native (mobile), Supabase

**Depends on:** Plan 1, 2, 5 (bookings)

---

### Task 1: Check-in API

Create `packages/api/src/routes/checkin.ts`:

- `GET /api/classes/:classId/roster` — photo grid data (staff only)
  Returns: array of { user: { id, name, avatar_url }, booking: { id, status, spot }, attendance: { checked_in, walk_in }, membership_notes: string }

- `POST /api/classes/:classId/checkin` — batch check-in (staff only)
  Body: `{ attendees: [{ userId, checkedIn: boolean, walkIn?: boolean }] }`
  Creates/updates attendance records. Sets `checked_in_by` to authenticated teacher.
  Also transitions class status to `in_progress` on first check-in.

- `POST /api/classes/:classId/walkin` — add walk-in (staff only)
  Body: `{ userId }` or `{ name, email }` (for non-members)
  Creates attendance record with `walk_in = true`. If user isn't a member, optionally create a guest record.

**Tests:** Roster data shape, batch check-in, walk-in creation, class status transition.

---

### Task 2: Complete class

`POST /api/classes/:classId/complete` — staff marks class as done

1. Set status to `completed`
2. Mark any booked-but-not-checked-in as `no_show`
3. Enable feed for this class instance
4. Trigger post-class notifications

**Tests:** Status transition, no-show marking, only works for in_progress classes.

---

### Task 3: Web check-in UI

Create `apps/web/src/app/dashboard/classes/[id]/checkin/page.tsx`:

Photo grid layout:
- Grid of member cards (avatar, name, booking status)
- Tap to toggle checked-in (green border = checked in)
- Walk-in button to add someone
- Member notes visible as hover/tooltip
- "Complete Class" button at bottom
- Counter: "12/15 checked in"

Should be fast and touch-friendly (works on tablet at the studio front desk).

**Tests:** Grid renders, toggle state, walk-in flow.

---

### Task 4: Mobile check-in UI

Create `apps/mobile/src/app/(tabs)/class/[id]/checkin.tsx`:

Same photo grid concept adapted for mobile:
- Scrollable grid of member avatars
- Tap to check in
- Swipe for options (walk-in, notes)
- Big "Done" button

Share types/interfaces with web via `@studio-coop/shared`.

---

### Task 5: Attendance history

`GET /api/studios/:studioId/attendance?from=&to=` — staff view
- Attendance by class, by member, by date range
- Stats: total classes, average attendance, no-show rate

`GET /api/my/attendance` — member view
- Personal attendance history
- Streak tracking (consecutive weeks attended)
- Total classes this month/year

**Tests:** Date filtering, stat calculations, streak logic.
