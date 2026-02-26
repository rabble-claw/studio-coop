import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, uuid, text, timestamp, integer, time, date, jsonb } from 'drizzle-orm/pg-core'

// Inline schema subset needed by the web app
// Full schema lives in packages/db/src/schema.ts

export const studios = pgTable('studios', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  discipline: text('discipline').notNull(),
  description: text('description'),
  tier: text('tier').default('free'),
  timezone: text('timezone').notNull().default('UTC'),
  settings: jsonb('settings').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull(),
  studioId: uuid('studio_id').notNull(),
  role: text('role').notNull(),
  status: text('status').default('active'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
})

export const classTemplates = pgTable('class_templates', {
  id: uuid('id').primaryKey(),
  studioId: uuid('studio_id').notNull(),
  name: text('name').notNull(),
  teacherId: uuid('teacher_id'),
  startTime: time('start_time').notNull(),
  durationMin: integer('duration_min').notNull(),
  maxCapacity: integer('max_capacity'),
})

export const classInstances = pgTable('class_instances', {
  id: uuid('id').primaryKey(),
  templateId: uuid('template_id'),
  studioId: uuid('studio_id').notNull(),
  teacherId: uuid('teacher_id'),
  date: date('date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  status: text('status').default('scheduled'),
  maxCapacity: integer('max_capacity'),
})

export const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey(),
  classInstanceId: uuid('class_instance_id').notNull(),
  userId: uuid('user_id').notNull(),
  status: text('status').default('booked'),
})

let _pool: Pool | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

const schema = { studios, users, memberships, classTemplates, classInstances, bookings }

export function getDb() {
  if (!_db) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
    _db = drizzle(_pool, { schema })
  }
  return _db
}

export function getPool(): Pool {
  if (!_pool) getDb()
  return _pool!
}
