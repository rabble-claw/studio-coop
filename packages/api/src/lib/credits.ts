// Credit check helpers — used by the booking system to determine
// how a user pays for a class and to deduct/refund accordingly.

import { createServiceClient } from './supabase'

export interface CreditCheck {
  hasCredits: boolean
  source:
    | 'subscription_unlimited'
    | 'subscription_limited'
    | 'class_pack'
    | 'comp_class'
    | 'none'
  /** ID of the subscription, class_pass, or comp_class record being used */
  sourceId?: string
  /** Remaining credits after deduction (undefined for unlimited) */
  remainingAfter?: number
}

/**
 * Determine which credit source a user should use for a class booking.
 *
 * Priority order:
 * 1. Comp classes (free credits — use first)
 * 2. Unlimited subscription
 * 3. Limited subscription (with classes remaining this period)
 * 4. Class pack (oldest first, non-expired)
 * 5. None → needs drop-in purchase
 */
export async function checkBookingCredits(
  userId: string,
  studioId: string,
): Promise<CreditCheck> {
  const supabase = createServiceClient()
  const now = new Date()

  // ── 1. Comp classes ──────────────────────────────────────────────────────
  const { data: compClasses } = await supabase
    .from('comp_classes')
    .select('id, remaining_classes, expires_at')
    .eq('user_id', userId)
    .eq('studio_id', studioId)
    .gt('remaining_classes', 0)
    .order('expires_at', { ascending: true })

  const validComp = (compClasses ?? []).find(
    (c) => !c.expires_at || new Date(c.expires_at) > now,
  )
  if (validComp) {
    return {
      hasCredits: true,
      source: 'comp_class',
      sourceId: validComp.id,
      remainingAfter: validComp.remaining_classes - 1,
    }
  }

  // ── 2 & 3. Active subscription ────────────────────────────────────────────
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, plan_id, status, classes_used_this_period, plan:membership_plans(type, class_limit)')
    .eq('user_id', userId)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .maybeSingle()

  if (subscription) {
    const plan = Array.isArray(subscription.plan) ? subscription.plan[0] : subscription.plan
    if (plan) {
      // Unlimited subscription
      if (plan.type === 'unlimited') {
        return {
          hasCredits: true,
          source: 'subscription_unlimited',
          sourceId: subscription.id,
        }
      }

      // Limited subscription — check if classes remain this period
      if (plan.type === 'limited' && plan.class_limit !== null) {
        const used = subscription.classes_used_this_period ?? 0
        if (used < plan.class_limit) {
          return {
            hasCredits: true,
            source: 'subscription_limited',
            sourceId: subscription.id,
            remainingAfter: plan.class_limit - used - 1,
          }
        }
      }
    }
  }

  // ── 4. Class packs (oldest first, non-expired) ────────────────────────────
  const { data: classPasses } = await supabase
    .from('class_passes')
    .select('id, remaining_classes, expires_at')
    .eq('user_id', userId)
    .eq('studio_id', studioId)
    .gt('remaining_classes', 0)
    .order('created_at', { ascending: true }) // oldest pack first

  const validPass = (classPasses ?? []).find(
    (p) => !p.expires_at || new Date(p.expires_at) > now,
  )
  if (validPass) {
    return {
      hasCredits: true,
      source: 'class_pack',
      sourceId: validPass.id,
      remainingAfter: validPass.remaining_classes - 1,
    }
  }

  // ── 5. No credits ─────────────────────────────────────────────────────────
  return { hasCredits: false, source: 'none' }
}

/**
 * Deduct one credit from the identified source.
 * Call this when a booking is confirmed.
 */
export async function deductCredit(creditCheck: CreditCheck): Promise<void> {
  if (!creditCheck.hasCredits || creditCheck.source === 'none') return

  const supabase = createServiceClient()

  switch (creditCheck.source) {
    case 'comp_class': {
      await supabase
        .from('comp_classes')
        .update({ remaining_classes: creditCheck.remainingAfter })
        .eq('id', creditCheck.sourceId!)
      break
    }
    case 'subscription_limited': {
      // Increment classes_used_this_period
      await supabase.rpc('increment_classes_used', { subscription_id: creditCheck.sourceId! })
      break
    }
    case 'class_pack': {
      await supabase
        .from('class_passes')
        .update({ remaining_classes: creditCheck.remainingAfter })
        .eq('id', creditCheck.sourceId!)
      break
    }
    case 'subscription_unlimited':
      // No counter to update for unlimited subs
      break
    default:
      break
  }
}

/**
 * Refund one credit back to the source.
 * Call this when a booking is cancelled.
 */
export async function refundCredit(creditCheck: CreditCheck): Promise<void> {
  if (!creditCheck.hasCredits || creditCheck.source === 'none') return

  const supabase = createServiceClient()

  switch (creditCheck.source) {
    case 'comp_class': {
      // remainingAfter was set at deduct time; add 1 back
      const restore =
        creditCheck.remainingAfter !== undefined ? creditCheck.remainingAfter + 1 : 1
      await supabase
        .from('comp_classes')
        .update({ remaining_classes: restore })
        .eq('id', creditCheck.sourceId!)
      break
    }
    case 'subscription_limited': {
      await supabase.rpc('decrement_classes_used', { subscription_id: creditCheck.sourceId! })
      break
    }
    case 'class_pack': {
      const restore =
        creditCheck.remainingAfter !== undefined ? creditCheck.remainingAfter + 1 : 1
      await supabase
        .from('class_passes')
        .update({ remaining_classes: restore })
        .eq('id', creditCheck.sourceId!)
      break
    }
    case 'subscription_unlimited':
      break
    default:
      break
  }
}
