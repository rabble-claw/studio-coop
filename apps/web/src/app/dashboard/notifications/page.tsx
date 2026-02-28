'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { notificationApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  sent_at: string
  read_at: string | null
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      try {
        const result = await notificationApi.list()
        setNotifications(result.notifications)
      } catch {
        setError('Failed to load notifications. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleMarkRead(id: string) {
    try {
      await notificationApi.markRead(id)
      setNotifications(notifications.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    } catch {
      // Silently fail
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead()
      setNotifications(notifications.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    } catch {
      // Silently fail
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' })
  }

  const typeIcons: Record<string, string> = {
    booking_confirmation: '✓',
    booking_reminder: '⏰',
    class_cancelled: '✕',
    waitlist_available: '★',
    studio_invite: '✉',
    payment: '$',
    general: '●',
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading notifications...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>Mark all read</Button>
        )}
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {notifications.length === 0 && !error ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No notifications yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" aria-live="polite">
          {notifications.map(notif => (
            <Card
              key={notif.id}
              className={`cursor-pointer transition-colors ${!notif.read_at ? 'bg-primary/5 border-primary/20' : ''}`}
              onClick={() => !notif.read_at && handleMarkRead(notif.id)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !notif.read_at) { e.preventDefault(); handleMarkRead(notif.id) } }}
              tabIndex={!notif.read_at ? 0 : undefined}
              role={!notif.read_at ? 'button' : undefined}
              aria-label={!notif.read_at ? `Mark as read: ${notif.title}` : undefined}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm shrink-0" aria-hidden="true">
                    {typeIcons[notif.type] ?? '●'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{notif.title}</span>
                      {!notif.read_at && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      )}
                      {!notif.read_at && <span className="sr-only">(unread)</span>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(notif.sent_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
