'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getDemoUnreadCount } from '@/lib/demo-data'
import { notificationApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

const navItems = [
  { path: '', label: 'Overview', icon: '🏠' },
  { path: '/schedule', label: 'Schedule', icon: '📅' },
  { path: '/members', label: 'Members', icon: '👥' },
  { path: '/plans', label: 'Plans', icon: '💳' },
  { path: '/feed', label: 'Feed', icon: '📸' },
  { path: '/network', label: 'Network', icon: '🤝' },
  { path: '/coupons', label: 'Coupons', icon: '🏷️' },
  { path: '/private-bookings', label: 'Bookings', icon: '🔒' },
  { path: '/reports', label: 'Reports', icon: '📊' },
  { path: '/migrate', label: 'Migrate', icon: '📦' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

interface DashboardShellProps {
  children: React.ReactNode
  mode?: 'live' | 'demo'
  basePath?: string
}

export function DashboardShell({ children, mode = 'live', basePath = '/dashboard' }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (mode === 'demo') return

    async function fetchCount() {
      try {
        const result = await notificationApi.count()
        setUnreadCount(result.unreadCount)
      } catch {
        // API not available
      }
    }

    fetchCount()
    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [mode])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const displayCount = mode === 'demo' ? getDemoUnreadCount() : unreadCount

  return (
    <div className="min-h-screen">
      {mode === 'demo' && (
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm">
          You&apos;re viewing the demo.{' '}
          <Link href="/login?mode=signup" className="underline font-medium">
            Sign up free
          </Link>{' '}
          to create your own studio.
        </div>
      )}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14">
          <div className="flex items-center gap-6">
            <Link href={basePath} className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">SC</span>
              </div>
              <span className="font-semibold hidden sm:inline">Studio Co-op</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {navItems.map((item) => {
                const href = basePath + item.path
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap min-h-[44px] min-w-[44px] justify-center',
                      pathname === href
                        ? 'bg-secondary text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`${basePath}/notifications`}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            >
              <span className="text-lg">🔔</span>
              {displayCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {displayCount}
                </span>
              )}
            </Link>
            {mode === 'demo' ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">Exit Demo</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  )
}
