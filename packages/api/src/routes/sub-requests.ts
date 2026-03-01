// Sub request routes — teachers can request substitutes for classes they can't teach
//
//   GET  /:studioId/sub-requests           — list sub requests for the studio
//   POST /:studioId/sub-requests           — create a sub request
//   POST /:studioId/sub-requests/:requestId/accept — accept a sub request
//   POST /:studioId/sub-requests/:requestId/cancel — cancel a sub request
//   GET  /:studioId/sub-requests/my        — current user's sub requests

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireMember, requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'
import { badRequest, forbidden, notFound } from '../lib/errors'

const subRequests = new Hono()

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/sub-requests — list sub requests for the studio
// ─────────────────────────────────────────────────────────────────────────────

subRequests.get('/:studioId/sub-requests', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const supabase = createServiceClient()

  const statusFilter = c.req.query('status') ?? 'open'
  const teacherFilter = c.req.query('teacher_id')

  let query = supabase
    .from('sub_requests')
    .select(`
      id, status, reason, created_at, accepted_at,
      requesting_teacher:users!sub_requests_requesting_teacher_id_fkey(id, name, avatar_url),
      substitute_teacher:users!sub_requests_substitute_teacher_id_fkey(id, name, avatar_url),
      class_instance:class_instances!sub_requests_class_instance_id_fkey(
        id, date, start_time, end_time, status,
        template:class_templates!class_instances_template_id_fkey(id, name)
      )
    `)
    .eq('studio_id', studioId)
    .order('created_at', { ascending: false })

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (teacherFilter) {
    query = query.eq('requesting_teacher_id', teacherFilter)
  }

  const { data, error } = await query

  if (error) throw error

  const results = (data ?? []).map((r: any) => {
    const reqTeacher = Array.isArray(r.requesting_teacher) ? r.requesting_teacher[0] : r.requesting_teacher
    const subTeacher = Array.isArray(r.substitute_teacher) ? r.substitute_teacher[0] : r.substitute_teacher
    const classInst = Array.isArray(r.class_instance) ? r.class_instance[0] : r.class_instance
    const template = classInst ? (Array.isArray(classInst.template) ? classInst.template[0] : classInst.template) : null

    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      created_at: r.created_at,
      accepted_at: r.accepted_at,
      requesting_teacher: reqTeacher ?? null,
      substitute_teacher: subTeacher ?? null,
      class_info: classInst ? {
        id: classInst.id,
        name: template?.name ?? 'Unknown',
        date: classInst.date,
        start_time: classInst.start_time,
        end_time: classInst.end_time,
      } : null,
    }
  })

  return c.json(results)
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /:studioId/sub-requests/my — current user's sub requests
// ─────────────────────────────────────────────────────────────────────────────

subRequests.get('/:studioId/sub-requests/my', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('sub_requests')
    .select(`
      id, status, reason, created_at, accepted_at,
      requesting_teacher:users!sub_requests_requesting_teacher_id_fkey(id, name, avatar_url),
      substitute_teacher:users!sub_requests_substitute_teacher_id_fkey(id, name, avatar_url),
      class_instance:class_instances!sub_requests_class_instance_id_fkey(
        id, date, start_time, end_time, status,
        template:class_templates!class_instances_template_id_fkey(id, name)
      )
    `)
    .eq('studio_id', studioId)
    .or(`requesting_teacher_id.eq.${user.id},substitute_teacher_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  const results = (data ?? []).map((r: any) => {
    const reqTeacher = Array.isArray(r.requesting_teacher) ? r.requesting_teacher[0] : r.requesting_teacher
    const subTeacher = Array.isArray(r.substitute_teacher) ? r.substitute_teacher[0] : r.substitute_teacher
    const classInst = Array.isArray(r.class_instance) ? r.class_instance[0] : r.class_instance
    const template = classInst ? (Array.isArray(classInst.template) ? classInst.template[0] : classInst.template) : null

    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      created_at: r.created_at,
      accepted_at: r.accepted_at,
      requesting_teacher: reqTeacher ?? null,
      substitute_teacher: subTeacher ?? null,
      class_info: classInst ? {
        id: classInst.id,
        name: template?.name ?? 'Unknown',
        date: classInst.date,
        start_time: classInst.start_time,
        end_time: classInst.end_time,
      } : null,
    }
  })

  return c.json(results)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/sub-requests — create a sub request
// ─────────────────────────────────────────────────────────────────────────────

subRequests.post('/:studioId/sub-requests', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const classInstanceId = body.class_instance_id as string | undefined

  if (!classInstanceId) throw badRequest('class_instance_id is required')

  // Verify the class instance exists and belongs to this studio
  const { data: classInstance } = await supabase
    .from('class_instances')
    .select('id, teacher_id, date, start_time, studio_id')
    .eq('id', classInstanceId)
    .eq('studio_id', studioId)
    .single()

  if (!classInstance) throw notFound('Class instance')

  // Verify the requesting user is the teacher for this class
  if (classInstance.teacher_id !== user.id) {
    throw forbidden('Only the assigned teacher can request a substitute')
  }

  // Check that the class hasn't already started
  const now = new Date()
  const classDateTime = new Date(`${classInstance.date}T${classInstance.start_time}`)
  if (classDateTime <= now) {
    throw badRequest('Cannot request a substitute for a class that has already started')
  }

  // Check for existing open request
  const { data: existing } = await supabase
    .from('sub_requests')
    .select('id')
    .eq('class_instance_id', classInstanceId)
    .in('status', ['open'])
    .maybeSingle()

  if (existing) {
    throw badRequest('A sub request already exists for this class')
  }

  const { data: subRequest, error } = await supabase
    .from('sub_requests')
    .insert({
      class_instance_id: classInstanceId,
      studio_id: studioId,
      requesting_teacher_id: user.id,
      reason: (body.reason as string) || null,
    })
    .select('*')
    .single()

  if (error) throw error

  return c.json(subRequest, 201)
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/sub-requests/:requestId/accept — accept a sub request
// ─────────────────────────────────────────────────────────────────────────────

subRequests.post('/:studioId/sub-requests/:requestId/accept', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const requestId = c.req.param('requestId')
  const user = c.get('user' as never) as { id: string }
  const supabase = createServiceClient()

  // Verify the user is a teacher in this studio
  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('studio_id', studioId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!membership) throw notFound('Membership')

  const teacherRoles = ['teacher', 'admin', 'owner']
  if (!teacherRoles.includes(membership.role)) {
    throw forbidden('Only teachers can accept sub requests')
  }

  // Get the sub request
  const { data: subRequest } = await supabase
    .from('sub_requests')
    .select('id, status, class_instance_id, requesting_teacher_id')
    .eq('id', requestId)
    .eq('studio_id', studioId)
    .single()

  if (!subRequest) throw notFound('Sub request')
  if (subRequest.status !== 'open') throw badRequest('This sub request is no longer open')
  if (subRequest.requesting_teacher_id === user.id) throw badRequest('You cannot accept your own sub request')

  // Update the sub request
  const { error: updateError } = await supabase
    .from('sub_requests')
    .update({
      substitute_teacher_id: user.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateError) throw updateError

  // Update the class instance teacher
  const { error: classError } = await supabase
    .from('class_instances')
    .update({ teacher_id: user.id })
    .eq('id', subRequest.class_instance_id)

  if (classError) throw classError

  return c.json({ message: 'Sub request accepted', requestId })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /:studioId/sub-requests/:requestId/cancel — cancel a sub request
// ─────────────────────────────────────────────────────────────────────────────

subRequests.post('/:studioId/sub-requests/:requestId/cancel', authMiddleware, requireMember, async (c) => {
  const studioId = c.get('studioId' as never) as string
  const requestId = c.req.param('requestId')
  const user = c.get('user' as never) as { id: string }
  const memberRole = c.get('memberRole' as never) as string
  const supabase = createServiceClient()

  // Get the sub request
  const { data: subRequest } = await supabase
    .from('sub_requests')
    .select('id, status, requesting_teacher_id')
    .eq('id', requestId)
    .eq('studio_id', studioId)
    .single()

  if (!subRequest) throw notFound('Sub request')
  if (subRequest.status !== 'open') throw badRequest('Only open sub requests can be cancelled')

  // Only the requesting teacher or staff can cancel
  const staffRoles = ['admin', 'owner']
  if (subRequest.requesting_teacher_id !== user.id && !staffRoles.includes(memberRole)) {
    throw forbidden('Only the requesting teacher or studio staff can cancel a sub request')
  }

  const { error } = await supabase
    .from('sub_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)

  if (error) throw error

  return c.json({ message: 'Sub request cancelled', requestId })
})

export { subRequests }
export default subRequests
