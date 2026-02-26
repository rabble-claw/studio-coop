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
