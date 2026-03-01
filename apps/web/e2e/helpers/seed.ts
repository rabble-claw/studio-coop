/**
 * Seed data constants matching supabase/seed.sql.
 * Used by authenticated (@auth) E2E tests.
 */

// Fixed UUIDs from seed.sql
export const SEED = {
  studio: {
    id: 'bb000000-0000-0000-0000-000000000001',
    name: 'Empire Aerial Arts',
    slug: 'empire-aerial-arts',
    discipline: 'aerial',
  },

  // Auth users for authenticated tests
  // Emails match seed.sql; passwords are set in auth.users inserts
  owner: {
    id: 'aa000000-0000-0000-0000-000000000001',
    email: 'alex@empireaerialarts.com',
    password: 'testpass123!',
    name: 'Alex Rivera',
    role: 'owner',
  },
  teacher: {
    id: 'aa000000-0000-0000-0000-000000000002',
    email: 'jade@empireaerialarts.com',
    password: 'testpass123!',
    name: 'Jade Nguyen',
    role: 'teacher',
  },
  member: {
    id: 'aa000000-0000-0000-0000-000000000010',
    email: 'aroha@gmail.com',
    password: 'testpass123!',
    name: 'Aroha Patel',
    role: 'member',
  },
} as const

export type SeedRole = 'owner' | 'teacher' | 'member'
