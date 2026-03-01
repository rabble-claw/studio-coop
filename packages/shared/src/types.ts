// Core domain types for Studio Co-op

export type Discipline = 'pole' | 'bjj' | 'yoga' | 'crossfit' | 'cycling' | 'pilates' | 'dance' | 'aerial' | 'general'

export type StudioTier = 'free' | 'studio' | 'pro'

export type MemberRole = 'member' | 'teacher' | 'admin' | 'owner'

export type BookingStatus = 'booked' | 'confirmed' | 'waitlisted' | 'cancelled' | 'no_show'

export type ClassStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export type FeedPostType = 'post' | 'achievement' | 'milestone' | 'auto'

export interface Studio {
  id: string
  name: string
  slug: string
  discipline: Discipline
  description?: string
  logoUrl?: string
  timezone: string
  currency: string
  settings: StudioSettings
  tier: StudioTier
  createdAt: Date
}

export interface StudioSettings {
  cancellationWindowHours: number
  defaultMaxCapacity: number
  confirmationReminderHours: number[]  // e.g. [24, 2]
  feedEnabled: boolean
  waitlistEnabled: boolean
  spotSelectionEnabled: boolean
}

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  phone?: string
  createdAt: Date
}

export interface Membership {
  id: string
  userId: string
  studioId: string
  role: MemberRole
  status: 'active' | 'suspended' | 'cancelled'
  notes?: string       // staff-only
  tags: string[]
  joinedAt: Date
}

export interface ClassTemplate {
  id: string
  studioId: string
  name: string
  description?: string
  teacherId: string
  dayOfWeek: number    // 0=Sunday
  startTime: string    // "09:00"
  durationMin: number
  maxCapacity: number
  location?: string
  recurrence: 'weekly' | 'biweekly' | 'monthly' | 'once'
  settings: Record<string, unknown>  // discipline-specific
  active: boolean
}

export interface ClassInstance {
  id: string
  templateId: string
  studioId: string
  teacherId: string
  date: string         // "2026-03-15"
  startTime: string
  endTime: string
  status: ClassStatus
  maxCapacity: number
  notes?: string
  feedEnabled: boolean
}

export interface Booking {
  id: string
  classInstanceId: string
  userId: string
  status: BookingStatus
  spot?: string
  bookedAt: Date
  confirmedAt?: Date
  cancelledAt?: Date
  waitlistPosition?: number
}

export interface Attendance {
  id: string
  classInstanceId: string
  userId: string
  checkedIn: boolean
  checkedInAt?: Date
  checkedInBy?: string
  walkIn: boolean
}

export interface FeedPost {
  id: string
  classInstanceId: string
  userId: string
  content?: string
  mediaUrls: string[]
  postType: FeedPostType
  createdAt: Date
}

// ============================================================
// V2: PAYMENTS & FEATURES
// ============================================================

export type MembershipPlanType = 'unlimited' | 'limited' | 'class_pack' | 'drop_in' | 'intro'
export type MembershipPlanInterval = 'month' | 'year' | 'once'
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'paused'
export type CouponType = 'percent_off' | 'amount_off' | 'free_classes'
export type CouponAppliesTo = 'any' | 'plan' | 'drop_in' | 'new_member'
export type PrivateBookingType = 'party' | 'private_tuition' | 'group'
export type PrivateBookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled'
export type CrossBookingPolicy = 'full_price' | 'discounted' | 'included'
export type MigrationSource = 'mindbody' | 'vagaro' | 'csv'
export type MigrationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface MembershipPlan {
  id: string
  studioId: string
  name: string
  description?: string
  type: MembershipPlanType
  priceCents: number
  currency: string
  interval: MembershipPlanInterval
  classLimit?: number
  validityDays?: number
  stripePriceId?: string
  active: boolean
  sortOrder: number
  createdAt: Date
}

export interface Subscription {
  id: string
  userId: string
  studioId: string
  planId: string
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  status: SubscriptionStatus
  currentPeriodStart?: Date
  currentPeriodEnd?: Date
  classesUsedThisPeriod: number
  cancelledAt?: Date
  createdAt: Date
}

export interface ClassPass {
  id: string
  userId: string
  studioId: string
  planId?: string
  totalClasses: number
  remainingClasses: number
  purchasedAt: Date
  expiresAt?: Date
  stripePaymentIntentId?: string
}

export interface Payment {
  id: string
  userId: string
  studioId: string
  type: 'subscription' | 'class_pack' | 'drop_in' | 'private_booking'
  amountCents: number
  currency: string
  stripePaymentIntentId?: string
  refunded: boolean
  refundAmountCents: number
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface CompClass {
  id: string
  userId: string
  studioId: string
  grantedBy?: string
  reason?: string
  totalClasses: number
  remainingClasses: number
  expiresAt?: Date
  createdAt: Date
}

export interface Coupon {
  id: string
  studioId: string
  code: string
  type: CouponType
  value: number
  appliesTo: CouponAppliesTo
  planIds: string[]
  maxRedemptions?: number
  currentRedemptions: number
  validFrom?: Date
  validUntil?: Date
  active: boolean
  createdAt: Date
}

export interface CouponRedemption {
  id: string
  couponId: string
  userId: string
  studioId: string
  appliedToType?: string
  appliedToId?: string
  discountAmountCents: number
  redeemedAt: Date
}

export interface StudioNetwork {
  id: string
  name: string
  description?: string
  createdAt: Date
}

export interface StudioNetworkMember {
  id: string
  networkId: string
  studioId: string
  crossBookingPolicy: CrossBookingPolicy
  discountPercent?: number
  joinedAt: Date
}

export interface PrivateBooking {
  id: string
  studioId: string
  userId: string
  type: PrivateBookingType
  title: string
  description?: string
  notes?: string
  date: string        // "2026-03-15"
  startTime: string   // "19:00"
  endTime: string     // "21:00"
  attendeeCount?: number
  priceCents?: number
  depositCents?: number
  depositPaid: boolean
  status: PrivateBookingStatus
  stripePaymentIntentId?: string
  createdAt: Date
}

export interface MigrationImport {
  id: string
  studioId: string
  source: MigrationSource
  fileName?: string
  status: MigrationStatus
  importedCounts: Record<string, number>
  errors: unknown[]
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

// ============================================================
// V3: FINANCIAL PLANNER
// ============================================================

export type CompensationType = 'per_class' | 'monthly_salary' | 'revenue_share' | 'hybrid'
export type ExpenseRecurrence = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface ExpenseCategory {
  id: string
  name: string
  icon: string
  sortOrder: number
}

export interface StudioExpense {
  id: string
  studioId: string
  categoryId: string
  name: string
  amountCents: number
  currency: string
  recurrence: ExpenseRecurrence
  startDate: string
  endDate?: string | null
  notes?: string | null
  createdBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface InstructorCompensation {
  id: string
  studioId: string
  instructorId: string
  compType: CompensationType
  perClassRateCents: number
  monthlySalaryCents: number
  revenueSharePercent: number
  effectiveFrom: string
  effectiveUntil?: string | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface FinancialSnapshot {
  id: string
  studioId: string
  month: string
  revenueCents: number
  revenueBreakdown: Record<string, number>
  expensesCents: number
  expenseBreakdown: Record<string, number>
  instructorCostsCents: number
  netIncomeCents: number
  activeMembers: number
  classesHeld: number
  computedAt: Date
}

export interface HealthScore {
  overall: number
  profitMargin: { score: number; value: number }
  classUtilization: { score: number; value: number }
  rentRatio: { score: number; value: number }
  instructorCostRatio: { score: number; value: number }
  revenueTrend: { score: number; value: number }
  revenuePerMember: { score: number; value: number }
}

export interface ScenarioResult {
  current: {
    members: number
    revenue: number
    expenses: number
    instructorCosts: number
    netIncome: number
  }
  projected: {
    members: number
    revenue: number
    expenses: number
    instructorCosts: number
    netIncome: number
  }
  changes: {
    membersDelta: number
    revenueDelta: number
    expensesDelta: number
    instructorCostsDelta: number
    netIncomeDelta: number
  }
}
