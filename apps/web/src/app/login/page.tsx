'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup' | 'magic'>('login')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('mode') === 'signup') {
      setMode('signup')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const supabase = createClient()

    if (mode === 'magic') {
      const { error: err } = await supabase.auth.signInWithOtp({ email })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Check your email for a magic link!')
      }
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Account created! Check your email to confirm, then sign in.')
        // After signup confirmation, they'll be redirected to setup
        router.push('/dashboard/setup')
      }
      setLoading(false)
      return
    }

    // Login
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      setError(err.message)
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
                    required
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
                    required
                    minLength={6}
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

            <div className="mt-6 pt-4 border-t text-center">
              <Link href="/demo" className="text-sm text-muted-foreground hover:text-foreground">
                Or try the demo first →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
