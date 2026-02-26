import { z } from 'zod'

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(50).default(2.5),
  WEB_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

/**
 * Validate and return the current process environment.
 * Throws a descriptive error if any required variables are missing or invalid.
 */
export function getConfig(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors
    const details = Object.entries(fieldErrors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${details}`)
  }
  return result.data
}
