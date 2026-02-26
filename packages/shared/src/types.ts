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
