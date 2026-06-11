'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getDemoUnreadCount } from '@/lib/demo-data'
import { notificationApi } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { StudioSwitcher } from '@/components/studio-switcher'
import { useStudioId } from '@/hooks/use-studio-id'
import {
  Home,
  CalendarDays,
  Users,
  Wallet,
  BarChart3,
  Sparkles,
  Settings,
  Bell,
} from 'lucide-react'

const navItems = [
  { path: '', labelKey: 'overview', Icon: Home },
  { path: '/schedule', labelKey: 'schedule', Icon: CalendarDays },
  { path: '/members', labelKey: 'members', Icon: Users },
  { path: '/money', labelKey: 'money', Icon: Wallet },
  { path: '/reports', labelKey: 'reports', Icon: BarChart3 },
  { path: '/copilot', labelKey: 'copilot', Icon: Sparkles },
  { path: '/settings', labelKey: 'settings', Icon: Settings },
] as const

interface DashboardShellProps {
  children: React.ReactNode
  mode?: 'live' | 'demo'
  basePath?: string
}

export function DashboardShell({ children, mode = 'live', basePath = '/dashboard' }: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations('common')
  const nav = useTranslations('common.nav')
  const [unreadCount, setUnreadCount] = useState(0)
  const { studios, studioId, switchStudio } = useStudioId(mode === 'demo')

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

  const isActive = (href: string) =>
    href === basePath ? pathname === href : pathname.startsWith(href)

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded"
      >
        Skip to main content
      </a>
      {mode === 'demo' && (
        <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm" role="status">
          {t('demoBanner')}{' '}
          <Link href="/login?mode=signup" className="underline font-medium">
            {t('demoBannerCta')}
          </Link>{' '}
          {t('demoBannerSuffix')}
        </div>
      )}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex items-center px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 shrink-0">
            <Link href={basePath} className="flex items-center gap-2" aria-label="Studio Co-op home">
              <div className="w-7 h-7 bg-primary rounded-md rounded-tr-xl flex items-center justify-center shadow-[2px_2px_0_0_var(--color-accent)]" aria-hidden="true">
                <span className="text-primary-foreground font-display italic font-semibold text-sm leading-none">S</span>
              </div>
              <span className="font-display font-semibold tracking-tight hidden sm:inline">{t('appName')}</span>
            </Link>
            {mode === 'live' && (
              <StudioSwitcher
                studios={studios}
                currentStudioId={studioId}
                onSwitch={switchStudio}
              />
            )}
          </div>
          <nav aria-label="Dashboard navigation" className="flex-1 flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => {
              const href = basePath + item.path
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors whitespace-nowrap min-h-[44px] min-w-[44px] justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'text-primary font-semibold after:absolute after:left-3 after:right-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  )}
                >
                  <item.Icon size={16} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  <span className="hidden lg:inline">{nav(item.labelKey)}</span>
                  <span className="lg:hidden sr-only">{nav(item.labelKey)}</span>
                </Link>
              )
            })}
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`${basePath}/notifications`}
              className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={displayCount > 0 ? `Notifications (${displayCount} unread)` : 'Notifications'}
            >
              <Bell size={18} aria-hidden="true" />
              {displayCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
                  {displayCount}
                </span>
              )}
            </Link>
            {mode === 'demo' ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">{t('exitDemo')}</Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                {t('signOut')}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
    </div>
  )
}
