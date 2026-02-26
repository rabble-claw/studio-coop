import { createServiceClient } from './supabase'

// Milestone thresholds for class count celebrations
const CLASS_COUNT_MILESTONES = [1, 10, 25, 50, 100, 200, 500]

// Number of consecutive weeks that qualify as a streak milestone
const STREAK_WEEKS = 4

/**
 * Check for milestones after a user is checked in to a class.
 * Creates system feed posts with post_type='milestone' for any achieved milestones.
 * Respects studio's settings.autoMilestones flag (defaults true if unset).
 */
export async function checkAndCreateMilestones(
  userId: string,
  studioId: string,
  classInstanceId: string,
): Promise<void> {
  const supabase = createServiceClient()

  // Respect studio autoMilestones setting
  const { data: studio } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  const settings = (studio?.settings ?? {}) as Record<string, unknown>
  if (settings.autoMilestones === false) return

  // Fetch user name for milestone messages
  const { data: user } = await supabase
    .from('users')
    .select('name')
    .eq('id', userId)
    .single()

  if (!user) return
  const memberName = user.name

  const milestoneMessages: string[] = []

  // ── Class count milestone ──────────────────────────────────────────────────

  const { count: totalClasses } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('checked_in', true)
    .in(
      'class_instance_id',
      (
        await supabase
          .from('class_instances')
          .select('id')
          .eq('studio_id', studioId)
      ).data?.map((c) => c.id) ?? [],
    )

  if (totalClasses !== null && CLASS_COUNT_MILESTONES.includes(totalClasses)) {
    if (totalClasses === 1) {
      milestoneMessages.push(`⭐ ${memberName} attended their first class at this studio!`)
    } else {
      milestoneMessages.push(`🎉 ${memberName} just completed their ${totalClasses}th class!`)
    }
  }

  // ── Attendance streak (4 consecutive weeks) ────────────────────────────────

  if (milestoneMessages.length === 0) {
    // Only check streak if we haven't already found a milestone (avoid post flood)
    const streakAchieved = await checkStreak(userId, studioId, STREAK_WEEKS)
    if (streakAchieved) {
      milestoneMessages.push(`🔥 ${memberName} has a ${STREAK_WEEKS}-week attendance streak!`)
    }
  }

  // ── Create milestone feed posts ────────────────────────────────────────────

  for (const content of milestoneMessages) {
    // Use a system user approach: post as the member (userId) with post_type='milestone'
    await supabase.from('feed_posts').insert({
      class_instance_id: classInstanceId,
      user_id: userId,
      content,
      media_urls: [],
      post_type: 'milestone',
    })
  }
}

/**
 * Returns true if the user has attended at least one class per week
 * for the last `weeks` consecutive weeks at the given studio.
 */
async function checkStreak(userId: string, studioId: string, weeks: number): Promise<boolean> {
  const supabase = createServiceClient()

  // Get studio class instance IDs for the lookback window
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7 - 1)

  const { data: studioClasses } = await supabase
    .from('class_instances')
    .select('id, date')
    .eq('studio_id', studioId)
    .gte('date', cutoff.toISOString().split('T')[0])

  if (!studioClasses || studioClasses.length === 0) return false

  const classIds = studioClasses.map((c) => c.id)

  const { data: attended } = await supabase
    .from('attendance')
    .select('class_instance_id')
    .eq('user_id', userId)
    .eq('checked_in', true)
    .in('class_instance_id', classIds)

  if (!attended || attended.length === 0) return false

  // Map attended class IDs to dates
  const attendedClassIds = new Set(attended.map((a) => a.class_instance_id))
  const attendedDates = studioClasses
    .filter((c) => attendedClassIds.has(c.id))
    .map((c) => new Date(c.date + 'T00:00:00'))

  // Check if there's at least one attendance per week for the last `weeks` weeks
  const now = new Date()
  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (w + 1) * 7)
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() - w * 7)

    const attendedThisWeek = attendedDates.some((d) => d >= weekStart && d < weekEnd)
    if (!attendedThisWeek) return false
  }

  return true
}
