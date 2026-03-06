import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

const OUTREACH_SYSTEM_PROMPT = `You are writing a personalized outreach message for a fitness/wellness studio in New Zealand.
The studio owner wants to re-engage a member who may be at risk of leaving.

Tone guidelines by stage:
- gentle_nudge: Warm, casual check-in. "Hey [name], just noticed you haven't been in for a bit..."
- we_miss_you: Friendly, acknowledging their absence. "We miss seeing you at the studio!"
- incentive: Include a specific offer or incentive. "We'd love to welcome you back with..."
- final: Heartfelt, no pressure. "We understand life gets busy, but your spot is always here."

Rules:
- Keep subject line under 60 characters
- Body should be 3-5 sentences, personal but not pushy
- Reference specific details when provided (class preferences, name)
- Sign off warmly but don't be overly familiar
- Return JSON with "subject" and "body" fields`

export async function POST(req: NextRequest) {
  try {
    const { memberName, riskFactors, stage, studioName, studioId } = await req.json()

    if (!memberName || !stage || !studioId) {
      return NextResponse.json(
        { error: 'Missing required fields: memberName, stage, studioId' },
        { status: 400 }
      )
    }

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-5-20250514'),
      system: OUTREACH_SYSTEM_PROMPT,
      prompt: `Draft an outreach message for:
- Member: ${memberName}
- Studio: ${studioName || 'the studio'}
- Stage: ${stage}
- Risk factors: ${JSON.stringify(riskFactors || {})}

Return a JSON object with "subject" and "body" fields.`,
      maxTokens: 500,
    })

    // Parse the LLM response
    let parsed: { subject: string; body: string }
    try {
      // Try to extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { subject: 'We miss you!', body: text }
    } catch {
      parsed = { subject: 'We miss you!', body: text }
    }

    // Save draft to outreach_messages
    const supabase = await createClient()
    const { data: msg, error } = await supabase
      .from('outreach_messages')
      .insert({
        studio_id: studioId,
        user_id: req.headers.get('x-user-id') || '',
        stage,
        subject: parsed.subject,
        body: parsed.body,
        channel: 'email',
        status: 'draft',
      })
      .select('id, subject, body, stage, status, created_at')
      .single()

    if (error) {
      console.error('[outreach] DB error:', error)
      // Return the draft even if DB save fails
      return NextResponse.json({ draft: { subject: parsed.subject, body: parsed.body, stage } })
    }

    return NextResponse.json({ draft: msg })
  } catch (error) {
    console.error('[outreach] Error drafting message:', error)
    return NextResponse.json(
      { error: 'Failed to draft outreach message' },
      { status: 500 }
    )
  }
}
