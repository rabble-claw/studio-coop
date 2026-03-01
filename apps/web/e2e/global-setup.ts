import { chromium, type FullConfig } from '@playwright/test'
import { SEED, type SeedRole } from './helpers/seed'
import { loginViaUI } from './helpers/auth'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

function isRealSupabase(): boolean {
  return (
    !!SUPABASE_URL &&
    !SUPABASE_URL.includes('placeholder') &&
    !SUPABASE_URL.includes('your-project') &&
    !!SERVICE_KEY
  )
}

/**
 * Ensure the three test users exist in Supabase Auth.
 * Uses the admin API (service role key) to create them idempotently.
 */
async function ensureAuthUsers() {
  const roles: SeedRole[] = ['owner', 'teacher', 'member']

  for (const role of roles) {
    const user = SEED[role]
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { name: user.name },
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      // 422 = user already exists — that's fine
      if (res.status !== 422) {
        console.warn(`[global-setup] Failed to create ${role} user: ${res.status} ${body}`)
      }
    }
  }
}

/**
 * Log in each role via the UI and save browser storage state.
 */
async function saveAuthStates() {
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const browser = await chromium.launch()

  const roles: SeedRole[] = ['owner', 'teacher', 'member']
  for (const role of roles) {
    const user = SEED[role]
    const context = await browser.newContext()
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

export default async function globalSetup(_config: FullConfig) {
  if (!isRealSupabase()) {
    console.log('[global-setup] Skipping — no real Supabase URL configured')
    return
  }

  console.log('[global-setup] Creating auth users...')
  await ensureAuthUsers()

  console.log('[global-setup] Saving auth states...')
  await saveAuthStates()
}
