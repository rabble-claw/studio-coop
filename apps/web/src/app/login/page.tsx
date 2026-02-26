'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isDemoMode } from '@/lib/demo-data'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const demo = isDemoMode()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (demo) {
      // Demo mode — simulate auth without a real backend
      await new Promise((r) => setTimeout(r, 800))
      if (mode === 'magic') {
        setMessage('✨ Demo mode — redirecting to dashboard...')
        setTimeout(() => router.push('/dashboard'), 1000)
      } else if (mode === 'signup') {
        setMessage('✨ Account created! Redirecting to dashboard...')
        setTimeout(() => router.push('/dashboard'), 1000)
      } else {
        router.push('/dashboard')
      }
      setLoading(false)
      return
    }

    // Real backend auth via our API routes
    if (mode === 'magic') {
      setError('Magic links require Supabase. Use email/password instead.')
      setLoading(false)
      return
    }

    const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    const body = mode === 'signup' ? { email, password, name } : { email, password }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SC</span>
            </div>
          </Link>
          <h1 className="text-2xl font-bold">Welcome to Studio Co-op</h1>
          <p className="text-muted-foreground text-sm mt-1">Your studio community awaits</p>
        </div>

        {demo && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>Demo mode</strong> — enter any email to explore the dashboard
          </div>
        )}

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === 'login' && 'Sign in'}
              {mode === 'signup' && 'Create account'}
              {mode === 'magic' && 'Magic link'}
            </CardTitle>
            <CardDescription>
              {mode === 'magic'
                ? "We'll send you a link to sign in"
                : 'Enter your credentials to continue'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!demo}
                  />
                </div>
              )}
              <div>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {mode !== 'magic' && (
                <div>
                  <Input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!demo}
                    minLength={demo ? 0 : 6}
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? 'Loading...'
                  : mode === 'magic'
                    ? 'Send magic link'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Sign in'}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => setMode('magic')}
                    className="text-primary hover:underline block w-full"
                  >
                    Sign in with magic link instead
                  </button>
                  <p className="text-muted-foreground">
                    No account?{' '}
                    <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                      Sign up
                    </button>
                  </p>
                </>
              )}
              {mode === 'signup' && (
                <p className="text-muted-foreground">
                  Already have an account?{' '}
                  <button onClick={() => setMode('login')} className="text-primary hover:underline">
                    Sign in
                  </button>
                </p>
              )}
              {mode === 'magic' && (
                <button onClick={() => setMode('login')} className="text-primary hover:underline">
                  Back to password sign in
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
