'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const t = useTranslations('auth')
  const tc = useTranslations('common')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password/update`,
    })

    if (err) {
      setError(err.message)
    } else {
      setMessage(t('resetLinkSent'))
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
            <CardTitle className="text-lg">{t('resetPassword')}</CardTitle>
            <CardDescription>{t('resetPasswordDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
              {message && <p className="text-sm text-green-600">{message}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? tc('sending') : t('sendResetLink')}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm">
              <Link href="/login" className="text-primary hover:underline">
                {t('backToLogin')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
