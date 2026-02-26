// Coupon routes — studio-scoped, mounted at /api/studios.
//
//   POST   /:studioId/coupons           — create coupon (admin/owner only)
//   GET    /:studioId/coupons           — list all coupons (staff)
//   PUT    /:studioId/coupons/:couponId — update coupon (admin/owner only)
//   DELETE /:studioId/coupons/:couponId — deactivate coupon (admin/owner only)
//   POST   /:studioId/coupons/validate  — validate a coupon code (auth required)
//   POST   /:studioId/coupons/redeem    — record coupon redemption (auth required)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff, requireAdmin } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { notFound, badRequest, conflict } from '../lib/errors'

const coupons = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/coupons — create coupon (admin/owner only)
// ─────────────────────────────────────────────────────────────────────────────

coupons.post('/:studioId/coupons', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Validate required fields
  const code      = body.code as string | undefined
  const type      = body.type as string | undefined
  const value     = body.value
  const appliesTo = (body.appliesTo as string | undefined) ?? 'any'

  if (!code || typeof code !== 'string' || code.trim().length < 2) {
    throw badRequest('code must be at least 2 characters')
  }
  if (!/^[A-Z0-9_-]+$/.test(code)) {
    throw badRequest('code may only contain uppercase letters, digits, underscores, and hyphens')
  }
  if (!type || !['percent_off', 'amount_off', 'free_classes'].includes(type)) {
    throw badRequest('type must be one of: percent_off, amount_off, free_classes')
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw badRequest('value must be a positive integer')
  }
  if (type === 'percent_off' && value > 100) {
    throw badRequest('percent_off value cannot exceed 100')
  }
  if (!['any', 'plan', 'drop_in', 'new_member'].includes(appliesTo)) {
    throw badRequest('appliesTo must be one of: any, plan, drop_in, new_member')
  }

  // Validate date logic
  const validFrom  = body.validFrom as string | undefined
  const validUntil = body.validUntil as string | undefined
  if (validFrom && validUntil && new Date(validFrom) >= new Date(validUntil)) {
    throw badRequest('validFrom must be before validUntil')
  }

  const maxRedemptions = body.maxRedemptions as number | undefined
  if (maxRedemptions !== undefined && (typeof maxRedemptions !== 'number' || maxRedemptions < 1)) {
    throw badRequest('maxRedemptions must be a positive integer')
  }

  const planIds = Array.isArray(body.planIds) ? body.planIds as string[] : []
  const active  = body.active !== undefined ? Boolean(body.active) : true

  // Check code uniqueness within studio
  const { data: existing } = await supabase
    .from('coupons')
    .select('id')
    .eq('studio_id', studioId)
    .eq('code', code)
    .maybeSingle()

  if (existing) throw conflict(`Coupon code "${code}" already exists for this studio`)

  const { data: coupon, error } = await supabase
    .from('coupons')
    .insert({
      studio_id:           studioId,
      code,
      type,
      value,
      applies_to:          appliesTo,
      plan_ids:            planIds,
      max_redemptions:     maxRedemptions ?? null,
      current_redemptions: 0,
      valid_from:          validFrom ?? null,
      valid_until:         validUntil ?? null,
      active,
    })
    .select()
    .single()

  if (error || !coupon) throw new Error(`Failed to create coupon: ${error?.message}`)

  return c.json({ coupon }, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/coupons — list all coupons (staff)
// ─────────────────────────────────────────────────────────────────────────────

coupons.get('/:studioId/coupons', authMiddleware, requireStaff, async (c) => {
  const studioId = c.req.param('studioId')
  const supabase = createServiceClient()

  const { data: couponList, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return c.json({ coupons: couponList ?? [] })
})

// ─────────────────────────────────────────────────────────────────────────────
// PUT /:studioId/coupons/:couponId — update coupon (admin/owner only)
// ─────────────────────────────────────────────────────────────────────────────

coupons.put('/:studioId/coupons/:couponId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const couponId = c.req.param('couponId')
  const supabase = createServiceClient()

  // Verify coupon belongs to this studio
  const { data: existing } = await supabase
    .from('coupons')
    .select('id, code')
    .eq('id', couponId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Coupon')

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>

  // Build update payload from allowed fields
  const updates: Record<string, unknown> = {}

  if (body.code !== undefined) {
    const newCode = body.code as string
    if (!/^[A-Z0-9_-]+$/.test(newCode) || newCode.length < 2) {
      throw badRequest('code may only contain uppercase letters, digits, underscores, and hyphens')
    }
    if (newCode !== existing.code) {
      const { data: dup } = await supabase
        .from('coupons')
        .select('id')
        .eq('studio_id', studioId)
        .eq('code', newCode)
        .neq('id', couponId)
        .maybeSingle()
      if (dup) throw conflict(`Coupon code "${newCode}" already exists`)
    }
    updates.code = newCode
  }
  if (body.type !== undefined) {
    if (!['percent_off', 'amount_off', 'free_classes'].includes(body.type as string)) {
      throw badRequest('Invalid type')
    }
    updates.type = body.type
  }
  if (body.value !== undefined) {
    if (typeof body.value !== 'number' || !Number.isInteger(body.value) || (body.value as number) < 1) {
      throw badRequest('value must be a positive integer')
    }
    updates.value = body.value
  }
  if (body.appliesTo !== undefined) updates.applies_to = body.appliesTo
  if (body.planIds !== undefined)   updates.plan_ids   = body.planIds
  if (body.maxRedemptions !== undefined) updates.max_redemptions = body.maxRedemptions
  if (body.validFrom !== undefined)  updates.valid_from  = body.validFrom
  if (body.validUntil !== undefined) updates.valid_until = body.validUntil
  if (body.active !== undefined)     updates.active      = Boolean(body.active)

  const { data: updated, error } = await supabase
    .from('coupons')
    .update(updates)
    .eq('id', couponId)
    .select()
    .single()

  if (error || !updated) throw new Error(`Failed to update coupon: ${error?.message}`)

  return c.json({ coupon: updated })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:studioId/coupons/:couponId — deactivate coupon (admin/owner only)
// ─────────────────────────────────────────────────────────────────────────────

coupons.delete('/:studioId/coupons/:couponId', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.req.param('studioId')
  const couponId = c.req.param('couponId')
  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from('coupons')
    .select('id')
    .eq('id', couponId)
    .eq('studio_id', studioId)
    .single()

  if (!existing) throw notFound('Coupon')

  await supabase
    .from('coupons')
    .update({ active: false })
    .eq('id', couponId)

  return c.json({ couponId, deactivated: true })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/coupons/validate — validate a coupon code (Task 3)
// Body: { code: string, planId?: string }
// Returns: { valid: boolean, discount?: {...}, reason?: string }
// ─────────────────────────────────────────────────────────────────────────────

coupons.post('/:studioId/coupons/validate', authMiddleware, async (c) => {
  const studioId = c.req.param('studioId')
  const user     = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const body   = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const code   = body.code as string | undefined
  const planId = body.planId as string | undefined

  if (!code || typeof code !== 'string') {
    throw badRequest('code is required')
  }

  // ── 1. Look up coupon ─────────────────────────────────────────────────────
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('studio_id', studioId)
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (!coupon) {
    return c.json({ valid: false, reason: 'Coupon code not found' })
  }

  // ── 2. Active check ───────────────────────────────────────────────────────
  if (!coupon.active) {
    return c.json({ valid: false, reason: 'Coupon is inactive' })
  }

  // ── 3. Date window check ──────────────────────────────────────────────────
  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return c.json({ valid: false, reason: 'Coupon is not yet valid' })
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return c.json({ valid: false, reason: 'Coupon has expired' })
  }

  // ── 4. Redemption limit check ─────────────────────────────────────────────
  if (
    coupon.max_redemptions !== null &&
    coupon.current_redemptions >= coupon.max_redemptions
  ) {
    return c.json({ valid: false, reason: 'Coupon redemption limit reached' })
  }

  // ── 5. Plan type check ────────────────────────────────────────────────────
  if (coupon.applies_to === 'plan') {
    if (!planId) {
      return c.json({ valid: false, reason: 'Coupon requires a plan to be selected' })
    }
    const planIds: string[] = coupon.plan_ids ?? []
    if (planIds.length > 0 && !planIds.includes(planId)) {
      return c.json({ valid: false, reason: 'Coupon does not apply to the selected plan' })
    }
  }

  // ── 6. New member check ───────────────────────────────────────────────────
  if (coupon.applies_to === 'new_member') {
    const { count } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('studio_id', studioId)

    if ((count ?? 0) > 0) {
      return c.json({ valid: false, reason: 'Coupon is only valid for new members' })
    }
  }

  // ── 7. Build discount description ─────────────────────────────────────────
  let description: string
  if (coupon.type === 'percent_off') {
    description = `${coupon.value}% off`
  } else if (coupon.type === 'amount_off') {
    description = `$${(coupon.value / 100).toFixed(2)} off`
  } else {
    description = `${coupon.value} free class${coupon.value > 1 ? 'es' : ''}`
  }

  return c.json({
    valid: true,
    discount: {
      type:        coupon.type,
      value:       coupon.value,
      description,
      appliesTo:   coupon.applies_to,
      couponId:    coupon.id,
    },
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/coupons/redeem — record coupon redemption (Task 4)
// Body: { code: string, appliedToType?: string, appliedToId?: string, discountAmountCents?: number }
// Applies coupon: records redemption, increments counter, grants comp classes if free_classes type.
// ─────────────────────────────────────────────────────────────────────────────

coupons.post('/:studioId/coupons/redeem', authMiddleware, async (c) => {
  const studioId = c.req.param('studioId')
  const user     = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const body              = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const code              = body.code as string | undefined
  const appliedToType     = body.appliedToType as string | undefined
  const appliedToId       = body.appliedToId as string | undefined
  const discountAmountCents = typeof body.discountAmountCents === 'number'
    ? body.discountAmountCents
    : 0

  if (!code || typeof code !== 'string') {
    throw badRequest('code is required')
  }

  // ── 1. Look up and validate coupon ────────────────────────────────────────
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*')
    .eq('studio_id', studioId)
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .maybeSingle()

  if (!coupon) throw notFound('Coupon')

  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    throw badRequest('Coupon is not yet valid')
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    throw badRequest('Coupon has expired')
  }
  if (
    coupon.max_redemptions !== null &&
    coupon.current_redemptions >= coupon.max_redemptions
  ) {
    throw badRequest('Coupon redemption limit reached')
  }

  // ── 2. Record redemption ──────────────────────────────────────────────────
  const { data: redemption, error: redemptionError } = await supabase
    .from('coupon_redemptions')
    .insert({
      coupon_id:             coupon.id,
      user_id:               user.id,
      studio_id:             studioId,
      applied_to_type:       appliedToType ?? null,
      applied_to_id:         appliedToId ?? null,
      discount_amount_cents: discountAmountCents,
    })
    .select()
    .single()

  if (redemptionError || !redemption) {
    throw new Error(`Failed to record redemption: ${redemptionError?.message}`)
  }

  // ── 3. Increment current_redemptions ──────────────────────────────────────
  await supabase
    .from('coupons')
    .update({ current_redemptions: coupon.current_redemptions + 1 })
    .eq('id', coupon.id)

  // ── 4. free_classes type → grant comp classes ────────────────────────────
  let compGrant: object | null = null
  if (coupon.type === 'free_classes') {
    const { data: comp } = await supabase
      .from('comp_classes')
      .insert({
        user_id:           user.id,
        studio_id:         studioId,
        granted_by:        null,
        reason:            `Coupon: ${coupon.code}`,
        total_classes:     coupon.value,
        remaining_classes: coupon.value,
        expires_at:        coupon.valid_until ?? null,
      })
      .select()
      .single()
    compGrant = comp
  }

  return c.json({
    redemptionId: redemption.id,
    couponType:   coupon.type,
    value:        coupon.value,
    compGrant,
  }, 201)
})

export { coupons }
export default coupons
