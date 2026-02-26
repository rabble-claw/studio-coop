# Class Instance Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically generate class instances from templates so the schedule stays populated weeks ahead.

**Architecture:** Scheduled function runs daily, generates instances 4 weeks ahead from active templates. Owners can override individual instances.

**Tech Stack:** Hono, Supabase, node-cron or Supabase pg_cron

**Depends on:** Plan 1, 2

---

### Task 1: Generation logic

Create `packages/api/src/lib/class-generator.ts`:

```typescript
async function generateClassInstances(studioId: string, weeksAhead: number = 4): Promise<number>
```

Logic:
1. Fetch all active templates for the studio
2. For each template, calculate which dates need instances based on recurrence:
   - `weekly` → every week on `day_of_week`
   - `biweekly` → every other week (need anchor date)
   - `monthly` → same day_of_week each month
   - `once` → only if no instance exists and template was just created
3. Check which instances already exist (don't duplicate — UNIQUE on template_id + date)
4. Batch insert new instances
5. Return count of instances created

Handle edge cases:
- Studio closure dates (stored in `studios.settings.closureDates: string[]`)
- Template with no `day_of_week` set (skip)
- Biweekly anchor calculation

**Tests:** Weekly generation, biweekly with anchor, skip existing, skip closures, monthly correctness.

---

### Task 2: Scheduled endpoint

`POST /api/admin/generate-classes` — platform admin trigger
`POST /api/studios/:studioId/generate-classes` — studio owner manual trigger

Also create a Supabase Edge Function or cron entry that calls this daily at midnight UTC.

**Tests:** Authorization, idempotency (running twice doesn't duplicate).

---

### Task 3: Instance modification

Existing endpoint enhancement — `PUT /api/classes/:classId`:

Owners can modify individual instances:
- Change teacher (`teacher_id`)
- Change capacity
- Change time
- Add notes ("Guest teacher today!")
- Cancel (`status = 'cancelled'`) → notify all booked members

When an instance is modified, it detaches from the template for that field (the template still generates future instances normally).

**Tests:** Teacher sub, capacity change, cancellation with notification trigger.

---

### Task 4: One-off class creation

`POST /api/studios/:studioId/classes` — create a one-off class instance without a template

Used for: workshops, special events, makeup classes. Fields: name, description, teacher, date, time, duration, capacity.

Creates a class_instance with `template_id = null`.

**Tests:** Creation without template, all fields set correctly.

---

### Task 5: Schedule view API

`GET /api/studios/:studioId/schedule?from=2026-03-01&to=2026-03-14`

Returns class instances for date range with:
- Template info (name, description)
- Teacher info (name, avatar)
- Booking count vs capacity
- Status

Supports filters: `?teacher=uuid`, `?template=uuid`, `?day=1,3,5`

**Tests:** Date range filtering, teacher filter, includes booking counts.
