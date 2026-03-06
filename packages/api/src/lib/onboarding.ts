// Adaptive onboarding sequence engine
//
// 6-step onboarding for new members, with adaptive logic that skips
// steps based on member behavior (e.g., already attended classes).

import { createServiceClient } from './supabase'
import { sendNotification } from './notifications'

export interface OnboardingStep {
  step: number
  name: string
  delay: number  // days after membership start
  channels: ('email' | 'push')[]
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { step: 0, name: 'welcome', delay: 0, channels: ['email', 'push'] },
  { step: 1, name: 'class_recommendation', delay: 1, channels: ['push'] },
  { step: 2, name: 'first_class_followup', delay: 3, channels: ['push'] },
  { step: 3, name: 'social_prompt', delay: 7, channels: ['push'] },
  { step: 4, name: 'progress_check', delay: 14, channels: ['email', 'push'] },
  { step: 5, name: 'milestone', delay: 30, channels: ['email'] },
]

const STEP_MESSAGES: Record<string, { title: string; body: string }> = {
  welcome: {
    title: 'Welcome to the studio!',
    body: "We're so excited to have you join us. Check out our class schedule and book your first session!",
  },
  class_recommendation: {
    title: 'Classes we think you\'ll love',
    body: "Based on what's popular at your studio, here are some classes to try this week. Book now to secure your spot!",
  },
  first_class_followup: {
    title: 'How was your first class?',
    body: "We hope you enjoyed your session! Keep the momentum going — regular practice makes all the difference.",
  },
  social_prompt: {
    title: 'Join the community',
    body: "Connect with other members in your class feed! Share your progress and cheer each other on.",
  },
  progress_check: {
    title: "How's your first 2 weeks going?",
    body: "You've been a member for 2 weeks now. We'd love to hear how things are going. Any questions? Just ask!",
  },
  milestone: {
    title: 'Congratulations on 30 days!',
    body: "You've hit your 30-day milestone — amazing! Consistency is key, and you're showing up. Keep it going!",
  },
}

/**
 * Start an onboarding sequence for a new member.
 * Inserts the sequence row and sends the welcome message.
 */
export async function startOnboarding(studioId: string, userId: string): Promise<void> {
  const supabase = createServiceClient()

  // Check if sequence already exists
  const { data: existing } = await supabase
    .from('onboarding_sequences')
    .select('id')
    .eq('studio_id', studioId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return // already onboarding

  // Insert sequence
  await supabase
    .from('onboarding_sequences')
    .insert({
      studio_id: studioId,
      user_id: userId,
      step: 0,
      status: 'active',
      last_step_at: new Date().toISOString(),
    })

  // Send welcome message immediately
  const msg = STEP_MESSAGES.welcome
  await sendNotification({
    userId,
    studioId,
    type: 'onboarding_welcome',
    title: msg.title,
    body: msg.body,
    channels: ['email', 'push', 'in_app'],
  })
}

/**
 * Advance a member's onboarding sequence to the next applicable step.
 * Called daily by the cron job.
 *
 * Adaptive logic:
 * - Skip `first_class_followup` if member has attended 3+ classes
 * - Skip `social_prompt` if member has posted in the feed
 */
export async function advanceOnboarding(
  studioId: string,
  userId: string,
  currentStep: number,
  startedAt: string
): Promise<{ advanced: boolean; newStep: number; completed: boolean }> {
  const supabase = createServiceClient()
  const now = new Date()
  const startDate = new Date(startedAt)
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

  // Find the next step
  let nextStep = currentStep + 1

  // Adaptive: check if we should skip steps
  if (nextStep <= 5) {
    // Check attendance for first_class_followup skip
    if (nextStep === 2) {
      const { count } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('checked_in_at', startedAt)

      if ((count ?? 0) >= 3) {
        nextStep = 3 // skip first_class_followup
      }
    }

    // Check feed posts for social_prompt skip
    if (nextStep === 3) {
      const { count } = await supabase
        .from('feed_posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startedAt)

      if ((count ?? 0) > 0) {
        nextStep = 4 // skip social_prompt
      }
    }
  }

  // Check if we've completed all steps
  if (nextStep > 5) {
    await supabase
      .from('onboarding_sequences')
      .update({
        status: 'completed',
        completed_at: now.toISOString(),
        step: 5,
      })
      .eq('studio_id', studioId)
      .eq('user_id', userId)

    return { advanced: false, newStep: 5, completed: true }
  }

  // Check if enough time has elapsed for the next step
  const stepDef = ONBOARDING_STEPS[nextStep]
  if (!stepDef || daysSinceStart < stepDef.delay) {
    return { advanced: false, newStep: currentStep, completed: false }
  }

  // Send the notification for this step
  const msg = STEP_MESSAGES[stepDef.name]
  if (msg) {
    await sendNotification({
      userId,
      studioId,
      type: `onboarding_${stepDef.name}`,
      title: msg.title,
      body: msg.body,
      channels: [...stepDef.channels, 'in_app'] as ('email' | 'push' | 'in_app')[],
    })
  }

  // Update the sequence
  await supabase
    .from('onboarding_sequences')
    .update({
      step: nextStep,
      last_step_at: now.toISOString(),
      ...(nextStep === 5 ? { status: 'completed', completed_at: now.toISOString() } : {}),
    })
    .eq('studio_id', studioId)
    .eq('user_id', userId)

  return {
    advanced: true,
    newStep: nextStep,
    completed: nextStep === 5,
  }
}
