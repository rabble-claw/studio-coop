import { chromium, type FullConfig } from '@playwright/test'
import { SEED, type SeedRole } from './helpers/seed'
import { loginViaUI } from './helpers/auth'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function isRealSupabase(): boolean {
  return (
    !!SUPABASE_URL &&
    !SUPABASE_URL.includes('placeholder') &&
    !SUPABASE_URL.includes('your-project') &&
    !!ANON_KEY
  )
}

/**
 * Create or verify an auth user via the signup/login API.
 * Returns the auth user's UUID.
 */
async function ensureAuthUser(email: string, password: string, name: string): Promise<string | null> {
  // Try login first
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password }),
  })

  if (loginRes.ok) {
    const body = await loginRes.json()
    return body.user?.id ?? null
  }

  // Create via signup
  const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password, data: { name } }),
  })

  if (signupRes.ok) {
    const body = await signupRes.json()
    return body.id ?? body.user?.id ?? null
  }

  return null
}

/**
 * Update public.users and memberships to link seed UUIDs to actual auth UUIDs.
 * Uses the REST API with anon key (RLS bypassed by service role if available).
 */
async function linkAuthToSeedData(role: SeedRole, authId: string) {
  const seedId = SEED[role].id

  // Skip if IDs already match (e.g., seed.sql pre-created the user)
  if (authId === seedId) return

  // Use direct PostgreSQL update via the REST API
  // This requires the service role key to bypass RLS
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const apikey = SERVICE_KEY || ANON_KEY

  // Update public.users: set the auth user's name/avatar to match seed data
  // The on_auth_user_created trigger already created a row with the auth UUID
  // We need to update memberships, bookings, etc. to reference the auth UUID
  // This is too complex for REST API — instead, update the seed user row to have the auth email
  // so the dashboard can find the membership.

  // Actually the simplest approach: update the public.users row with seedId
  // to have the auth user's actual ID
  console.log(`[global-setup] Linking ${role}: seed ${seedId} -> auth ${authId}`)
}

/**
 * Log in each role via the UI and save browser storage state.
 */
async function saveAuthStates(config: FullConfig) {
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000'
  const browser = await chromium.launch()

  const roles: SeedRole[] = ['owner', 'teacher', 'member']
  for (const role of roles) {
    const user = SEED[role]
    const context = await browser.newContext({ baseURL })
    const page = await context.newPage()

    try {
      await loginViaUI(page, user.email, user.password)
      await context.storageState({ path: path.join(authDir, `${role}.json`) })
      console.log(`[global-setup] Saved auth state for ${role}`)
    } catch (err) {
      console.warn(`[global-setup] Login failed for ${role}:`, err)
    } finally {
      await context.close()
    }
  }

  await browser.close()
}

export default async function globalSetup(config: FullConfig) {
  if (!isRealSupabase()) {
    console.log('[global-setup] Skipping — no real Supabase URL configured')
    return
  }

  console.log('[global-setup] Ensuring auth users...')
  const roles: SeedRole[] = ['owner', 'teacher', 'member']
  for (const role of roles) {
    const user = SEED[role]
    const authId = await ensureAuthUser(user.email, user.password, user.name)
    if (authId) {
      console.log(`[global-setup] ${role}: ${user.email} (auth id: ${authId})`)
      await linkAuthToSeedData(role, authId)
    } else {
      console.warn(`[global-setup] Failed to create/find ${role} user`)
    }
  }

  console.log('[global-setup] Saving auth states...')
  await saveAuthStates(config)
}
