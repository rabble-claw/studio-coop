'use client'

import { Suspense, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('auth')
  const tc = useTranslations('common')
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
        setMessage(t('magicLinkSent'))
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
        setMessage(t('accountCreated'))
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
          <h1 className="text-2xl font-bold">{t('welcomeTitle')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('welcomeSubtitle')}</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === 'login' && t('signIn')}
              {mode === 'signup' && t('createAccount')}
              {mode === 'magic' && t('magicLink')}
            </CardTitle>
            <CardDescription>
              {mode === 'magic'
                ? t('magicLinkDescription')
                : t('credentialsDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <Input
                    type="text"
                    placeholder={t('namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {mode !== 'magic' && (
                <div>
                  <Input
                    type="password"
                    placeholder={t('passwordPlaceholder')}
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
                  ? tc('loading')
                  : mode === 'magic'
                    ? t('sendMagicLink')
                    : mode === 'signup'
                      ? t('createAccount')
                      : t('signIn')}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-sm">
              {mode === 'login' && (
                <>
                  <button
                    onClick={() => setMode('magic')}
                    className="text-primary hover:underline block w-full"
                  >
                    {t('signInWithMagicLink')}
                  </button>
                  <p className="text-muted-foreground">
                    {t('noAccount')}{' '}
                    <button onClick={() => setMode('signup')} className="text-primary hover:underline">
                      {t('signUp')}
                    </button>
                  </p>
                </>
              )}
              {mode === 'signup' && (
                <p className="text-muted-foreground">
                  {t('alreadyHaveAccount')}{' '}
                  <button onClick={() => setMode('login')} className="text-primary hover:underline">
                    {t('signIn')}
                  </button>
                </p>
              )}
              {mode === 'magic' && (
                <button onClick={() => setMode('login')} className="text-primary hover:underline">
                  {t('backToPassword')}
                </button>
              )}
            </div>

            <div className="mt-6 pt-4 border-t text-center">
              <Link href="/demo" className="text-sm text-muted-foreground hover:text-foreground">
                {t('tryDemoFirst')} →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
