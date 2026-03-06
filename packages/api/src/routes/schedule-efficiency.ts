// Schedule efficiency analysis API
//
// Mounted at /api/studios in index.ts.
//
//   GET /:studioId/schedule/efficiency — schedule analysis (underbooked, overbooked, gaps, utilization)

import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireStaff } from '../middleware/studio-access'
import { createServiceClient } from '../lib/supabase'

const scheduleEfficiency = new Hono()

// ─── GET /:studioId/schedule/efficiency ───────────────────────────────────────
scheduleEfficiency.get('/:studioId/schedule/efficiency', authMiddleware, requireStaff, async (c) => {
  const studioId = c.get('studioId') as string
  const weeks = Math.min(Number(c.req.query('weeks')) || 4, 12)

  const supabase = createServiceClient()

  const cutoff = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Fetch recent class instances with template info
  const { data: instances } = await supabase
    .from('class_instances')
    .select(`
      id, date, start_time, end_time, max_capacity, booked_count, status,
      template:class_templates(id, name, day_of_week),
      teacher:users!class_instances_teacher_id_fkey(id, name)
    `)
    .eq('studio_id', studioId)
    .gte('date', cutoff)
    .in('status', ['scheduled', 'completed'])
    .order('date', { ascending: false })

  const all = instances ?? []

  // Group by template for utilization analysis
  const byTemplate: Record<string, {
    templateId: string
    name: string
    instances: Array<{ date: string; startTime: string; booked: number; capacity: number }>
  }> = {}

  const byTeacher: Record<string, { name: string; classCount: number }> = {}

  for (const inst of all) {
    const tpl = Array.isArray(inst.template) ? inst.template[0] : inst.template
    const teacher = Array.isArray(inst.teacher) ? inst.teacher[0] : inst.teacher
    const t = tpl as unknown as { id: string; name: string; day_of_week: number } | null
    const tc = teacher as unknown as { id: string; name: string } | null

    if (t) {
      if (!byTemplate[t.id]) {
        byTemplate[t.id] = { templateId: t.id, name: t.name, instances: [] }
      }
      byTemplate[t.id].instances.push({
        date: inst.date,
        startTime: inst.start_time,
        booked: inst.booked_count ?? 0,
        capacity: inst.max_capacity ?? 0,
      })
    }

    if (tc) {
      if (!byTeacher[tc.id]) {
        byTeacher[tc.id] = { name: tc.name, classCount: 0 }
      }
      byTeacher[tc.id].classCount++
    }
  }

  // Underbooked: classes consistently <50% full
  const underbooked = Object.values(byTemplate)
    .map(t => {
      const totalBooked = t.instances.reduce((s, i) => s + i.booked, 0)
      const totalCapacity = t.instances.reduce((s, i) => s + i.capacity, 0)
      const avgFillRate = totalCapacity > 0 ? totalBooked / totalCapacity : 0
      return {
        templateId: t.templateId,
        name: t.name,
        instanceCount: t.instances.length,
        avgFillRate: Math.round(avgFillRate * 100),
        avgAttendance: t.instances.length > 0
          ? Math.round(totalBooked / t.instances.length)
          : 0,
      }
    })
    .filter(t => t.avgFillRate < 50 && t.instanceCount >= 2)
    .sort((a, b) => a.avgFillRate - b.avgFillRate)

  // Overbooked: classes at or above capacity (potential waitlist candidates)
  const overbooked = Object.values(byTemplate)
    .map(t => {
      const atCapacity = t.instances.filter(i => i.capacity > 0 && i.booked >= i.capacity).length
      const totalBooked = t.instances.reduce((s, i) => s + i.booked, 0)
      const totalCapacity = t.instances.reduce((s, i) => s + i.capacity, 0)
      const avgFillRate = totalCapacity > 0 ? totalBooked / totalCapacity : 0
      return {
        templateId: t.templateId,
        name: t.name,
        instanceCount: t.instances.length,
        atCapacityCount: atCapacity,
        avgFillRate: Math.round(avgFillRate * 100),
      }
    })
    .filter(t => t.atCapacityCount > 0)
    .sort((a, b) => b.atCapacityCount - a.atCapacityCount)

  // Peak gaps: time slots with no classes but surrounded by popular slots
  // Simple heuristic: find hours of day with classes, identify missing hours between first and last
  const hourCounts: Record<number, number> = {}
  for (const inst of all) {
    const hour = parseInt(inst.start_time?.split(':')[0] ?? '0', 10)
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
  }

  const activeHours = Object.keys(hourCounts).map(Number).sort((a, b) => a - b)
  const peakGaps: Array<{ hour: number; label: string }> = []

  if (activeHours.length >= 2) {
    const minHour = activeHours[0]
    const maxHour = activeHours[activeHours.length - 1]
    for (let h = minHour; h <= maxHour; h++) {
      if (!hourCounts[h] && hourCounts[h - 1] && hourCounts[h + 1]) {
        const label = `${h}:00 - ${h + 1}:00`
        peakGaps.push({ hour: h, label })
      }
    }
  }

  // Instructor utilization
  const instructorUtilization = Object.entries(byTeacher)
    .map(([id, t]) => ({
      teacherId: id,
      name: t.name,
      classesInPeriod: t.classCount,
      classesPerWeek: Math.round(t.classCount / weeks * 10) / 10,
    }))
    .sort((a, b) => b.classesInPeriod - a.classesInPeriod)

  return c.json({
    period_weeks: weeks,
    total_classes: all.length,
    underbooked,
    overbooked,
    peakGaps,
    instructorUtilization,
  })
})

export { scheduleEfficiency }
export default scheduleEfficiency
