import { pgTable, uuid, text, timestamp, integer, boolean, time, date, jsonb, unique } from 'drizzle-orm/pg-core'

export const studios = pgTable('studios', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  discipline: text('discipline').notNull(), // pole, bjj, yoga, etc.
  description: text('description'),
  logoUrl: text('logo_url'),
  timezone: text('timezone').notNull(),
  currency: text('currency').default('USD'),
  settings: jsonb('settings').default('{}'),
  stripeAccountId: text('stripe_account_id'),
  tier: text('tier').default('free'), // free, studio, pro
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // matches supabase auth.users.id
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  role: text('role').notNull(), // member, teacher, admin, owner
  status: text('status').default('active'),
  notes: text('notes'), // staff-only
  tags: text('tags').array(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.userId, t.studioId),
])

export const classTemplates = pgTable('class_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  teacherId: uuid('teacher_id').references(() => users.id),
  dayOfWeek: integer('day_of_week'), // 0=Sunday
  startTime: time('start_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  maxCapacity: integer('max_capacity'),
  location: text('location'),
  recurrence: text('recurrence').default('weekly'),
  settings: jsonb('settings').default('{}'),
  active: boolean('active').default(true),
})

export const classInstances = pgTable('class_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  templateId: uuid('template_id').references(() => classTemplates.id),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  teacherId: uuid('teacher_id').references(() => users.id),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: text('status').default('scheduled'),
  maxCapacity: integer('max_capacity'),
  notes: text('notes'),
  feedEnabled: boolean('feed_enabled').default(true),
}, (t) => [
  unique().on(t.templateId, t.date),
])

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  classInstanceId: uuid('class_instance_id').references(() => classInstances.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: text('status').default('booked'),
  spot: text('spot'),
  bookedAt: timestamp('booked_at', { withTimezone: true }).defaultNow(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  waitlistPosition: integer('waitlist_position'),
})

export const attendance = pgTable('attendance', {
  id: uuid('id').primaryKey().defaultRandom(),
  classInstanceId: uuid('class_instance_id').references(() => classInstances.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  checkedIn: boolean('checked_in').default(false),
  checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
  checkedInBy: uuid('checked_in_by').references(() => users.id),
  walkIn: boolean('walk_in').default(false),
})

export const feedPosts = pgTable('feed_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  classInstanceId: uuid('class_instance_id').references(() => classInstances.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  content: text('content'),
  mediaUrls: text('media_urls').array(),
  postType: text('post_type').default('post'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id),
  type: text('type').notNull(),
  title: text('title'),
  body: text('body'),
  data: jsonb('data'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
})
