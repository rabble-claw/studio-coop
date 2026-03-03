'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function UpdatePasswordPage() {
  const t = useTranslations('auth')
  const tc = useTranslations('common')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase redirects with access_token in the URL hash.
    // The Supabase client automatically picks up the session from the hash
    // when onAuthStateChange fires with PASSWORD_RECOVERY event.
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })

    // Also check if we already have a session (page refresh after hash consumed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError(t('passwordTooShort'))
      return
    }

    if (password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'))
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })

    if (err) {
      setError(err.message)
    } else {
      setMessage(t('passwordUpdated'))
      setTimeout(() => router.push('/dashboard'), 1500)
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
            <CardTitle className="text-lg">{t('updatePassword')}</CardTitle>
            <CardDescription>{t('updatePasswordDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <p className="text-sm text-muted-foreground">{tc('loading')}</p>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Input
                      type="password"
                      placeholder={t('newPasswordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>
                  <div>
                    <Input
                      type="password"
                      placeholder={t('confirmPasswordPlaceholder')}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                  </div>

                  {error && <p className="text-sm text-destructive">{error}</p>}
                  {message && <p className="text-sm text-green-600">{message}</p>}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? tc('saving') : t('updatePasswordButton')}
                  </Button>
                </form>

                <div className="mt-4 text-center text-sm">
                  <Link href="/login" className="text-primary hover:underline">
                    {t('backToLogin')}
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
