import { z } from 'zod'

export const disciplineSchema = z.enum([
  'pole', 'bjj', 'yoga', 'crossfit', 'cycling', 'pilates', 'dance', 'aerial', 'general'
])

export const createStudioSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  discipline: disciplineSchema,
  description: z.string().max(500).optional(),
  timezone: z.string(),
  currency: z.string().default('USD'),
})

export const createClassTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  teacherId: z.string().uuid(),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMin: z.number().min(15).max(240),
  maxCapacity: z.number().min(1).max(200),
  location: z.string().optional(),
  recurrence: z.enum(['weekly', 'biweekly', 'monthly', 'once']).default('weekly'),
})

export const bookClassSchema = z.object({
  classInstanceId: z.string().uuid(),
  spot: z.string().optional(),
})

export const checkInSchema = z.object({
  classInstanceId: z.string().uuid(),
  attendees: z.array(z.object({
    userId: z.string().uuid(),
    checkedIn: z.boolean(),
    walkIn: z.boolean().default(false),
  })),
})

export const createFeedPostSchema = z.object({
  classInstanceId: z.string().uuid(),
  content: z.string().max(1000).optional(),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  postType: z.enum(['post', 'achievement', 'milestone']).default('post'),
})

// ============================================================
// V2: PAYMENTS & FEATURES
// ============================================================

export const createMembershipPlanSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['unlimited', 'limited', 'class_pack', 'drop_in', 'intro']),
  priceCents: z.number().int().min(0),
  currency: z.string().default('USD'),
  interval: z.enum(['month', 'year', 'once']),
  classLimit: z.number().int().min(1).optional(),
  validityDays: z.number().int().min(1).optional(),
  stripePriceId: z.string().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const createSubscriptionSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
  stripeSubscriptionId: z.string().optional(),
  stripeCustomerId: z.string().optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
})

export const purchaseClassPackSchema = z.object({
  planId: z.string().uuid().optional(),
  totalClasses: z.number().int().min(1),
  stripePaymentIntentId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})

export const createCouponSchema = z.object({
  code: z.string().min(2).max(50).regex(/^[A-Z0-9_-]+$/),
  type: z.enum(['percent_off', 'amount_off', 'free_classes']),
  value: z.number().int().min(1),
  appliesTo: z.enum(['any', 'plan', 'drop_in', 'new_member']).default('any'),
  planIds: z.array(z.string().uuid()).default([]),
  maxRedemptions: z.number().int().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  active: z.boolean().default(true),
})

export const redeemCouponSchema = z.object({
  code: z.string().min(1),
  appliedToType: z.string().optional(),
  appliedToId: z.string().uuid().optional(),
})

export const grantCompClassSchema = z.object({
  userId: z.string().uuid(),
  totalClasses: z.number().int().min(1),
  reason: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
})

export const createPrivateBookingSchema = z.object({
  type: z.enum(['party', 'private_tuition', 'group']),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  attendeeCount: z.number().int().min(1).optional(),
  priceCents: z.number().int().min(0).optional(),
  depositCents: z.number().int().min(0).optional(),
})

export const startMigrationImportSchema = z.object({
  source: z.enum(['mindbody', 'vagaro', 'csv']),
  fileName: z.string().optional(),
})
