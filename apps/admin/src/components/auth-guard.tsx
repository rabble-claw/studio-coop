'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim()).filter(Boolean)

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<'loading' | 'authorized' | 'unauthorized'>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Don't guard the login page
    if (pathname === '/login') {
      setState('authorized')
      return
    }

    async function checkAuth() {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser()

      if (error || !currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      // If ADMIN_EMAILS is configured, check against it
      if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(currentUser.email ?? '')) {
        setState('unauthorized')
        return
      }

      setState('authorized')
    }

    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && pathname !== '/login') {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [pathname, router])

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--muted-foreground)] border-t-[var(--primary)]" />
          <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
        </div>
      </div>
    )
  }

  if (state === 'unauthorized') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="mb-4 text-4xl">&#x1F6AB;</div>
          <h2 className="mb-2 text-lg font-bold">Unauthorized</h2>
          <p className="mb-4 text-sm text-[var(--muted-foreground)]">
            Your account ({user?.email}) does not have admin access.
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/login')
            }}
            className="rounded-lg bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-zinc-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
