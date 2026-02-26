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

// ============================================================
// V2: PAYMENTS & FEATURES
// ============================================================

export const membershipPlans = pgTable('membership_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // unlimited, limited, class_pack, drop_in, intro
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  interval: text('interval').notNull(), // month, year, once
  classLimit: integer('class_limit'),
  validityDays: integer('validity_days'),
  stripePriceId: text('stripe_price_id'),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  planId: uuid('plan_id').references(() => membershipPlans.id).notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),
  status: text('status').notNull().default('active'), // active, past_due, cancelled, paused
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  classesUsedThisPeriod: integer('classes_used_this_period').notNull().default(0),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const classPasses = pgTable('class_passes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  planId: uuid('plan_id').references(() => membershipPlans.id),
  totalClasses: integer('total_classes').notNull(),
  remainingClasses: integer('remaining_classes').notNull(),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
})

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  type: text('type').notNull(), // subscription, class_pack, drop_in, private_booking
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').notNull().default('USD'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  refunded: boolean('refunded').notNull().default(false),
  refundAmountCents: integer('refund_amount_cents').notNull().default(0),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const compClasses = pgTable('comp_classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  grantedBy: uuid('granted_by').references(() => users.id),
  reason: text('reason'),
  totalClasses: integer('total_classes').notNull(),
  remainingClasses: integer('remaining_classes').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  code: text('code').notNull(),
  type: text('type').notNull(), // percent_off, amount_off, free_classes
  value: integer('value').notNull(),
  appliesTo: text('applies_to').notNull().default('any'), // any, plan, drop_in, new_member
  planIds: uuid('plan_ids').array().default([]),
  maxRedemptions: integer('max_redemptions'),
  currentRedemptions: integer('current_redemptions').notNull().default(0),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.studioId, t.code),
])

export const couponRedemptions = pgTable('coupon_redemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  couponId: uuid('coupon_id').references(() => coupons.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  appliedToType: text('applied_to_type'),
  appliedToId: uuid('applied_to_id'),
  discountAmountCents: integer('discount_amount_cents').notNull().default(0),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }).defaultNow(),
})

export const studioNetworks = pgTable('studio_networks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const studioNetworkMembers = pgTable('studio_network_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  networkId: uuid('network_id').references(() => studioNetworks.id).notNull(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  crossBookingPolicy: text('cross_booking_policy').notNull().default('full_price'), // full_price, discounted, included
  discountPercent: integer('discount_percent'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  unique().on(t.networkId, t.studioId),
])

export const privateBookings = pgTable('private_bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // party, private_tuition, group
  title: text('title').notNull(),
  description: text('description'),
  notes: text('notes'),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  attendeeCount: integer('attendee_count'),
  priceCents: integer('price_cents'),
  depositCents: integer('deposit_cents'),
  depositPaid: boolean('deposit_paid').notNull().default(false),
  status: text('status').notNull().default('requested'), // requested, confirmed, completed, cancelled
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const migrationImports = pgTable('migration_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  studioId: uuid('studio_id').references(() => studios.id).notNull(),
  source: text('source').notNull(), // mindbody, vagaro, csv
  fileName: text('file_name'),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed
  importedCounts: jsonb('imported_counts').notNull().default('{}'),
  errors: jsonb('errors').notNull().default('[]'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
