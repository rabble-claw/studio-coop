import { NextResponse } from 'next/server'
import { signUp } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }
    const user = await signUp(email, password, name)
    return NextResponse.json({ user })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sign up failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
