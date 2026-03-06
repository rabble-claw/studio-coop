import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'

const BRIEF_SYSTEM_PROMPT = `You are Studio Copilot, writing a weekly business brief for a fitness/wellness studio owner in New Zealand.

Write a concise, actionable weekly summary in markdown format. Structure:

1. **Executive Summary** (2-3 sentences)
2. **Key Metrics** (bullet points with week-over-week changes)
3. **Retention Alert** (if at-risk members exist)
4. **3 Recommendations** (specific, actionable, prioritized)

Rules:
- All monetary values are in NZ cents — divide by 100 and format as NZD
- Keep it under 500 words
- Use bold for key numbers
- Be encouraging but honest about areas needing attention
- Reference specific numbers, not vague statements`

export async function POST(req: NextRequest) {
  try {
    const { data } = await req.json()

    if (!data) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-5-20250514'),
      system: BRIEF_SYSTEM_PROMPT,
      prompt: `Generate a weekly brief for this studio data:\n\n${JSON.stringify(data, null, 2)}`,
      maxTokens: 1000,
    })

    return NextResponse.json({ narrative: text })
  } catch (error) {
    console.error('[brief] Error generating narrative:', error)
    return NextResponse.json(
      { error: 'Failed to generate brief narrative' },
      { status: 500 }
    )
  }
}
