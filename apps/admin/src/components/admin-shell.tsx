'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: '\u{1F4CA}' },
  { href: '/studios', label: 'Studios', icon: '\u{1F3E2}' },
  { href: '/coop', label: 'Co-op', icon: '\u{1F91D}' },
  { href: '/system', label: 'System', icon: '\u{2699}\u{FE0F}' },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      setUserEmail(user?.email ?? null)
    }
    getUser()
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-[var(--border)] bg-[var(--card)] flex flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-[var(--border)] px-6">
          <span className="text-xl font-extrabold tracking-tight">Studio Co-op</span>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-[var(--muted)] text-[var(--foreground)]'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-[var(--border)] p-4">
          <div className="rounded-lg bg-[var(--muted)] p-3">
            <p className="text-xs font-medium text-[var(--muted-foreground)]">Platform Admin</p>
            <p className="text-sm font-semibold truncate">{userEmail ?? '...'}</p>
            <button
              onClick={handleSignOut}
              className="mt-2 w-full rounded-md bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-8">
          <h1 className="text-lg font-semibold">
            {NAV_ITEMS.find((item) => isActive(item.href))?.label ?? 'Admin'}
          </h1>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All systems operational
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
