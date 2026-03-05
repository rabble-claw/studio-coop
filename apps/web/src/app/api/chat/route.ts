import { streamText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createClient } from '@/lib/supabase/server'
import { advisorTools } from '@/lib/chat/tools'
import { buildSystemPrompt } from '@/lib/chat/system-prompt'

export const maxDuration = 60

const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRate(userId: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateMap.set(userId, { count: 1, resetAt: now + 60_000 })
    return true
  }
  return ++entry.count <= 20
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return new Response('Unauthorized', { status: 401 })

  if (!checkRate(session.user.id)) {
    return new Response('Too many requests. Please wait a moment.', { status: 429 })
  }

  const { messages, studioId } = await req.json()
  if (!studioId) return new Response('studioId required', { status: 400 })

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('studio_id', studioId)
    .eq('status', 'active')
    .single()

  if (!membership || !['teacher', 'admin', 'owner'].includes(membership.role)) {
    return new Response('Forbidden', { status: 403 })
  }

  const provider = process.env.CHAT_AI_PROVIDER || 'anthropic'
  const model =
    provider === 'google'
      ? google('gemini-2.0-flash')
      : anthropic('claude-sonnet-4-5-20250514')

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
  const tools = advisorTools(apiBase, studioId, session.access_token)

  const result = streamText({
    model,
    system: buildSystemPrompt(membership.role),
    messages,
    tools,
    maxSteps: 5,
  })

  return result.toDataStreamResponse()
}
