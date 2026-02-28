// Feature flag helper — resolves effective flag value for a studio.
//
// Resolution priority: studio-specific override > plan_tier > global default
// Usage: const enabled = await getFeatureFlag(supabase, studioId, 'waitlist')

import type { SupabaseClient } from '@supabase/supabase-js'

export interface FeatureFlag {
  id: string
  name: string
  description: string | null
  enabled: boolean
  scope: 'global' | 'studio' | 'plan_tier'
  studio_id: string | null
  plan_tier: string | null
  created_at: string
  updated_at: string
}

/**
 * Resolve the effective value of a single feature flag for a studio.
 *
 * Looks up flags in priority order:
 *   1. studio-specific override (scope='studio', studio_id=studioId)
 *   2. plan-tier override (scope='plan_tier', plan_tier matches studio's tier)
 *   3. global default (scope='global')
 *
 * Returns false if the flag doesn't exist at all.
 */
export async function getFeatureFlag(
  supabase: SupabaseClient,
  studioId: string,
  flagName: string,
): Promise<boolean> {
  // Fetch all matching flags for this name in one query
  const { data: flags } = await supabase
    .from('feature_flags')
    .select('*')
    .eq('name', flagName)

  if (!flags || flags.length === 0) return false

  // 1. Studio-specific override
  const studioFlag = flags.find(
    (f: FeatureFlag) => f.scope === 'studio' && f.studio_id === studioId,
  )
  if (studioFlag) return studioFlag.enabled

  // 2. Plan-tier override — look up studio's plan tier first
  const planTierFlags = flags.filter((f: FeatureFlag) => f.scope === 'plan_tier')
  if (planTierFlags.length > 0) {
    const { data: studio } = await supabase
      .from('studios')
      .select('plan_tier')
      .eq('id', studioId)
      .single()

    if (studio?.plan_tier) {
      const tierFlag = planTierFlags.find(
        (f: FeatureFlag) => f.plan_tier === studio.plan_tier,
      )
      if (tierFlag) return tierFlag.enabled
    }
  }

  // 3. Global default
  const globalFlag = flags.find((f: FeatureFlag) => f.scope === 'global')
  if (globalFlag) return globalFlag.enabled

  return false
}

/**
 * Resolve all effective feature flags for a studio.
 * Returns a map of flag name → enabled boolean.
 */
export async function getEffectiveFlags(
  supabase: SupabaseClient,
  studioId: string,
): Promise<Record<string, boolean>> {
  // Fetch all flags
  const { data: allFlags } = await supabase
    .from('feature_flags')
    .select('*')
    .order('name')

  if (!allFlags || allFlags.length === 0) return {}

  // Look up studio plan tier
  const { data: studio } = await supabase
    .from('studios')
    .select('plan_tier')
    .eq('id', studioId)
    .single()

  const planTier = studio?.plan_tier as string | undefined

  // Group by name, resolve priority
  const result: Record<string, boolean> = {}
  const grouped = new Map<string, FeatureFlag[]>()

  for (const flag of allFlags as FeatureFlag[]) {
    const list = grouped.get(flag.name) ?? []
    list.push(flag)
    grouped.set(flag.name, list)
  }

  for (const [name, flags] of grouped) {
    // Studio-specific
    const studioFlag = flags.find(
      (f) => f.scope === 'studio' && f.studio_id === studioId,
    )
    if (studioFlag) {
      result[name] = studioFlag.enabled
      continue
    }

    // Plan-tier
    if (planTier) {
      const tierFlag = flags.find(
        (f) => f.scope === 'plan_tier' && f.plan_tier === planTier,
      )
      if (tierFlag) {
        result[name] = tierFlag.enabled
        continue
      }
    }

    // Global
    const globalFlag = flags.find((f) => f.scope === 'global')
    if (globalFlag) {
      result[name] = globalFlag.enabled
    }
  }

  return result
}
