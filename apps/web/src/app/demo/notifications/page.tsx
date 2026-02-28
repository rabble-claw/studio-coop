'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { demoNotifications, notificationTypeIcons, DemoNotification } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type FilterMode = 'all' | 'unread'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function DemoNotificationsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterMode>('all')
  const [notifications, setNotifications] = useState<DemoNotification[]>(demoNotifications)

  const unreadCount = notifications.filter((n) => n.read_at === null).length

  const filtered = filter === 'unread'
    ? notifications.filter((n) => n.read_at === null)
    : notifications

  function handleMarkAllRead() {
    const now = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n))
    )
  }

  function handleNotificationClick(notif: DemoNotification) {
    // Mark as read
    if (notif.read_at === null) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id && n.read_at === null
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      )
    }
    // Navigate to referenced content
    if (notif.data?.class_id) {
      router.push(`/demo/classes/${notif.data.class_id}`)
    } else if (notif.data?.post_id) {
      router.push('/demo/feed')
    } else if (notif.data?.badge_id) {
      router.push('/demo/members/demo-user-rabble')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">{unreadCount} unread</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0}
          onClick={handleMarkAllRead}
        >
          Mark all read
        </Button>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === 'unread'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No notifications to show.
            </CardContent>
          </Card>
        ) : (
          filtered.map((notif) => (
            <Card
              key={notif.id}
              className={`${notif.read_at === null || notif.data ? 'cursor-pointer hover:bg-primary/10 transition-colors' : ''} ${notif.read_at === null ? 'border-primary/30 bg-primary/5' : ''}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">
                    {notificationTypeIcons[notif.type] ?? '📬'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{notif.title}</h3>
                      {notif.read_at === null && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.sent_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
