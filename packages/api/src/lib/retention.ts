// Retention scoring engine
//
// Computes a churn risk score (0-100) for each studio member based on
// weighted behavioral signals. Used by the daily cron job and copilot tools.

export interface RetentionInput {
  daysInactive: number          // Days since last attendance check-in
  attendanceLast4Weeks: number  // Classes attended in last 4 weeks
  attendancePrior4Weeks: number // Classes attended in prior 4 weeks
  subscriptionStatus: 'active' | 'cancel_at_period_end' | 'cancelled' | 'paused' | 'none'
  hasPaymentIssues: boolean     // Any failed/overdue payments
  memberTenureDays: number      // Days since membership started
  engagementScore: number       // 0-100 based on feed interactions, social features
}

export interface RetentionResult {
  score: number
  factors: Record<string, { weight: number; value: number; raw: number | string }>
  stage: 'none' | 'gentle_nudge' | 'we_miss_you' | 'incentive' | 'final'
}

// Weighted factors for risk score computation
const WEIGHTS = {
  days_inactive: 0.30,
  attendance_trend: 0.25,
  subscription_status: 0.20,
  payment_issues: 0.10,
  member_tenure: 0.10,
  engagement: 0.05,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Compute a retention risk score for a member.
 * Higher score = higher churn risk.
 */
export function computeRetentionScore(input: RetentionInput): RetentionResult {
  // Days inactive: 0 days = 0 risk, 30+ days = 100 risk (linear)
  const inactiveRisk = clamp(input.daysInactive / 30 * 100, 0, 100)

  // Attendance trend: compare last 4 weeks to prior 4 weeks
  let trendRisk = 50 // neutral if no prior data
  if (input.attendancePrior4Weeks > 0) {
    const ratio = input.attendanceLast4Weeks / input.attendancePrior4Weeks
    // ratio 1.0+ = 0 risk, ratio 0.0 = 100 risk
    trendRisk = clamp((1 - ratio) * 100, 0, 100)
  } else if (input.attendanceLast4Weeks > 0) {
    trendRisk = 0 // new member attending, low risk
  }

  // Subscription status
  const subStatusMap: Record<string, number> = {
    active: 0,
    paused: 40,
    cancel_at_period_end: 50,
    cancelled: 100,
    none: 30, // no subscription (drop-in only)
  }
  const subRisk = subStatusMap[input.subscriptionStatus] ?? 30

  // Payment issues
  const paymentRisk = input.hasPaymentIssues ? 100 : 0

  // Member tenure: new members (<90 days) are higher risk
  const tenureRisk = input.memberTenureDays < 90
    ? clamp((1 - input.memberTenureDays / 90) * 100, 0, 100)
    : 0

  // Engagement: low engagement = higher risk
  const engagementRisk = clamp(100 - input.engagementScore, 0, 100)

  // Weighted total
  const score = Math.round(
    inactiveRisk * WEIGHTS.days_inactive +
    trendRisk * WEIGHTS.attendance_trend +
    subRisk * WEIGHTS.subscription_status +
    paymentRisk * WEIGHTS.payment_issues +
    tenureRisk * WEIGHTS.member_tenure +
    engagementRisk * WEIGHTS.engagement
  )

  const clampedScore = clamp(score, 0, 100)

  // Stage mapping
  let stage: RetentionResult['stage'] = 'none'
  if (clampedScore >= 86) stage = 'final'
  else if (clampedScore >= 71) stage = 'incentive'
  else if (clampedScore >= 51) stage = 'we_miss_you'
  else if (clampedScore >= 26) stage = 'gentle_nudge'

  return {
    score: clampedScore,
    factors: {
      days_inactive: { weight: WEIGHTS.days_inactive, value: inactiveRisk, raw: input.daysInactive },
      attendance_trend: { weight: WEIGHTS.attendance_trend, value: trendRisk, raw: `${input.attendanceLast4Weeks}/${input.attendancePrior4Weeks}` },
      subscription_status: { weight: WEIGHTS.subscription_status, value: subRisk, raw: input.subscriptionStatus },
      payment_issues: { weight: WEIGHTS.payment_issues, value: paymentRisk, raw: input.hasPaymentIssues ? 'yes' : 'no' },
      member_tenure: { weight: WEIGHTS.member_tenure, value: tenureRisk, raw: input.memberTenureDays },
      engagement: { weight: WEIGHTS.engagement, value: engagementRisk, raw: input.engagementScore },
    },
    stage,
  }
}
