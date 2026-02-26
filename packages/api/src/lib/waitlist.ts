// Waitlist engine — manages adding members to the waitlist and promoting
// them when a spot opens up.  Called from booking and cancellation routes.

import { createServiceClient } from './supabase'
import { checkBookingCredits, deductCredit } from './credits'

/**
 * Add a user to the waitlist for a class.
 * Assigns the next sequential waitlist_position and creates a booking
 * with status = 'waitlisted'.
 */
export async function addToWaitlist(
  classId: string,
  userId: string,
): Promise<{ waitlist_position: number; bookingId: string }> {
  const supabase = createServiceClient()

  // Count current waitlisted entries to derive position (1-based)
  const { count } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('class_instance_id', classId)
    .eq('status', 'waitlisted')

  const nextPosition = (count ?? 0) + 1

  const { data: booking, error } = await supabase
    .from('bookings')
    .insert({
      class_instance_id: classId,
      user_id: userId,
      status: 'waitlisted',
      waitlist_position: nextPosition,
      booked_at: new Date().toISOString(),
    })
    .select('id, waitlist_position')
    .single()

  if (error || !booking) {
    throw new Error(`Failed to add to waitlist: ${error?.message ?? 'unknown error'}`)
  }

  return { waitlist_position: booking.waitlist_position, bookingId: booking.id }
}

/**
 * Return the user's current position in the waitlist (1-based), or null
 * if they are not waitlisted.
 */
export async function getWaitlistPosition(
  classId: string,
  userId: string,
): Promise<number | null> {
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('bookings')
    .select('waitlist_position')
    .eq('class_instance_id', classId)
    .eq('user_id', userId)
    .eq('status', 'waitlisted')
    .maybeSingle()

  return data?.waitlist_position ?? null
}

/**
 * Attempt to promote the first eligible person from the waitlist.
 *
 * Flow:
 * 1. Find waitlisted bookings in position order.
 * 2. For each, check if they still have credits.
 * 3. First person with credits → deduct, promote to 'booked', compact positions.
 * 4. If no one can be promoted, leave waitlist as-is.
 *
 * Call this after every cancellation or capacity increase.
 */
export async function promoteFromWaitlist(classId: string): Promise<void> {
  const supabase = createServiceClient()

  // Need studio_id to check credits
  const { data: classInstance } = await supabase
    .from('class_instances')
    .select('studio_id')
    .eq('id', classId)
    .single()

  if (!classInstance) return

  // Fetch waitlisted entries ordered by position ascending
  const { data: waitlisted } = await supabase
    .from('bookings')
    .select('id, user_id')
    .eq('class_instance_id', classId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: true })

  if (!waitlisted || waitlisted.length === 0) return

  for (const booking of waitlisted) {
    const creditCheck = await checkBookingCredits(booking.user_id, classInstance.studio_id)

    if (creditCheck.hasCredits) {
      // Deduct credit and promote
      await deductCredit(creditCheck)

      await supabase
        .from('bookings')
        .update({
          status: 'booked',
          waitlist_position: null,
          credit_source: creditCheck.source,
          credit_source_id: creditCheck.sourceId ?? null,
          booked_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      // TODO: send push notification via Plan 10 notifications system
      // "A spot opened up in [Class] — you're in!"
      console.log(`[waitlist] Promoted booking ${booking.id} (user ${booking.user_id})`)

      // Compact remaining waitlist positions (close the gap)
      const { data: remaining } = await supabase
        .from('bookings')
        .select('id')
        .eq('class_instance_id', classId)
        .eq('status', 'waitlisted')
        .order('waitlist_position', { ascending: true })

      if (remaining && remaining.length > 0) {
        await Promise.all(
          remaining.map((b, idx) =>
            supabase
              .from('bookings')
              .update({ waitlist_position: idx + 1 })
              .eq('id', b.id),
          ),
        )
      }

      return // Only promote one person per cancellation
    }
    // No credits — skip this person, try the next
  }
}
