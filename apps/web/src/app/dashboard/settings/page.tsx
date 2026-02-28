'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const DISCIPLINES = ['pole', 'bjj', 'yoga', 'crossfit', 'cycling', 'pilates', 'dance', 'aerial', 'general']

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Asia/Tokyo', 'Asia/Singapore',
]

interface StudioData {
  id: string
  name: string
  slug: string
  discipline: string
  description: string | null
  logo_url: string | null
  timezone: string
  currency: string
  settings: Record<string, unknown>
}

interface NotificationSettings {
  reminderHours: number[]
  confirmationEnabled: boolean
  reengagementEnabled: boolean
  reengagementDays: number
  feedNotifications: boolean
}

interface CancellationSettings {
  hours_before: number
  late_cancel_fee_cents: number
  no_show_fee_cents: number
  allow_self_cancel: boolean
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  reminderHours: [24, 2],
  confirmationEnabled: true,
  reengagementEnabled: true,
  reengagementDays: 14,
  feedNotifications: true,
}

const DEFAULT_CANCELLATION: CancellationSettings = {
  hours_before: 12,
  late_cancel_fee_cents: 0,
  no_show_fee_cents: 0,
  allow_self_cancel: true,
}

export default function SettingsPage() {
  const [studioId, setStudioId] = useState<string | null>(null)
  const [studio, setStudio] = useState<StudioData | null>(null)
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS)
  const [cancellation, setCancellation] = useState<CancellationSettings>(DEFAULT_CANCELLATION)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: membership } = await supabase
        .from('memberships')
        .select('studio_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (!membership) { setLoading(false); return }

      setStudioId(membership.studio_id)

      const { data: studioData, error: studioErr } = await supabase
        .from('studios')
        .select('id, name, slug, discipline, description, logo_url, timezone, currency, settings')
        .eq('id', membership.studio_id)
        .single()

      if (studioErr) { setError(studioErr.message); setLoading(false); return }

      if (studioData) {
        setStudio(studioData)
        const settings = (studioData.settings ?? {}) as Record<string, unknown>
        const c = settings.cancellation as Record<string, unknown> | undefined
        if (c) {
          setCancellation({
            hours_before: (c.hours_before as number) ?? 12,
            late_cancel_fee_cents: (c.late_cancel_fee_cents as number) ?? 0,
            no_show_fee_cents: (c.no_show_fee_cents as number) ?? 0,
            allow_self_cancel: (c.allow_self_cancel as boolean) ?? true,
          })
        }
      }

      try {
        const notifData = await api.get<{ notifications: NotificationSettings }>(
          `/studios/${membership.studio_id}/settings/notifications`
        )
        if (notifData?.notifications) setNotifications(notifData.notifications)
      } catch {
        // use defaults
      }

      setLoading(false)
    }
    load()
  }, [])

  function showSaved(section: string) {
    setSaved(section)
    setTimeout(() => setSaved(null), 2000)
  }

  async function handleSaveGeneral() {
    if (!studioId || !studio) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('studios')
      .update({
        name: studio.name,
        slug: studio.slug,
        discipline: studio.discipline,
        description: studio.description,
        logo_url: studio.logo_url,
        timezone: studio.timezone,
      })
      .eq('id', studioId)
    if (error) setSaveError(error.message)
    else showSaved('general')
    setSaving(false)
  }

  async function handleSaveNotifications() {
    if (!studioId) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.put(`/studios/${studioId}/settings/notifications`, notifications)
      showSaved('notifications')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    }
    setSaving(false)
  }

  async function handleSaveCancellation() {
    if (!studioId || !studio) return
    setSaving(true)
    setSaveError(null)
    const supabase = createClient()
    const updatedSettings = { ...(studio.settings ?? {}), cancellation }
    const { error } = await supabase
      .from('studios')
      .update({ settings: updatedSettings })
      .eq('id', studioId)
    if (error) setSaveError(error.message)
    else {
      setStudio({ ...studio, settings: updatedSettings })
      showSaved('cancellation')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio configuration</p>
      </div>

      {saveError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{saveError}</div>
      )}

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="cancellation">Cancellation Policy</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Studio Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {studio && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Studio Name</label>
                      <Input value={studio.name} onChange={e => setStudio({ ...studio, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">URL Slug</label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">studio.coop/</span>
                        <Input value={studio.slug} onChange={e => setStudio({ ...studio, slug: e.target.value })} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                      value={studio.description ?? ''}
                      onChange={e => setStudio({ ...studio, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Discipline</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={studio.discipline}
                        onChange={e => setStudio({ ...studio, discipline: e.target.value })}
                      >
                        {DISCIPLINES.map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Timezone</label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={studio.timezone}
                        onChange={e => setStudio({ ...studio, timezone: e.target.value })}
                      >
                        {TIMEZONES.map(tz => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Logo URL</label>
                    <Input
                      value={studio.logo_url ?? ''}
                      onChange={e => setStudio({ ...studio, logo_url: e.target.value || null })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveGeneral} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                    {saved === 'general' && <span className="text-sm text-green-600">Saved!</span>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Notification Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {([
                { key: 'confirmationEnabled' as const, label: 'Booking confirmations', desc: 'Email members when they book a class' },
                { key: 'reengagementEnabled' as const, label: 'Re-engagement emails', desc: 'Reach out to members who haven\'t attended recently' },
                { key: 'feedNotifications' as const, label: 'Feed notifications', desc: 'Notify members about new studio feed posts' },
              ]).map(item => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={notifications[item.key]}
                      onChange={e => setNotifications({ ...notifications, [item.key]: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
              <div className="py-2">
                <label className="text-sm font-medium">Reminder hours before class</label>
                <p className="text-xs text-muted-foreground mb-2">
                  Comma-separated list of hours (e.g. 24, 2)
                </p>
                <Input
                  className="w-48"
                  value={notifications.reminderHours.join(', ')}
                  onChange={e => {
                    const hours = e.target.value
                      .split(',')
                      .map(s => parseInt(s.trim()))
                      .filter(n => !isNaN(n) && n > 0)
                    setNotifications({ ...notifications, reminderHours: hours })
                  }}
                  placeholder="e.g. 24, 2"
                />
              </div>
              {notifications.reengagementEnabled && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <label className="text-sm font-medium">Re-engage after (days inactive)</label>
                  <Input
                    type="number"
                    className="w-24 mt-1"
                    value={notifications.reengagementDays}
                    onChange={e => setNotifications({ ...notifications, reengagementDays: parseInt(e.target.value) || 14 })}
                  />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveNotifications} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Notification Settings'}
                </Button>
                {saved === 'notifications' && <span className="text-sm text-green-600">Saved!</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancellation" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Cancellation Policy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cancellation window (hours before class)</label>
                <Input
                  type="number"
                  className="w-32 mt-1"
                  value={cancellation.hours_before}
                  onChange={e => setCancellation({ ...cancellation, hours_before: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Members must cancel at least {cancellation.hours_before} hours before class starts
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm">Allow self-cancellation</div>
                  <div className="text-xs text-muted-foreground">Members can cancel their own bookings</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={cancellation.allow_self_cancel}
                    onChange={e => setCancellation({ ...cancellation, allow_self_cancel: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Late cancellation fee</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32"
                    value={cancellation.late_cancel_fee_cents / 100}
                    onChange={e => setCancellation({ ...cancellation, late_cancel_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">No-show fee</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="w-32"
                    value={cancellation.no_show_fee_cents / 100}
                    onChange={e => setCancellation({ ...cancellation, no_show_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveCancellation} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Policy'}
                </Button>
                {saved === 'cancellation' && <span className="text-sm text-green-600">Saved!</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <div className="font-medium">💳 Stripe</div>
                  <div className="text-sm text-muted-foreground">Accept payments from members</div>
                </div>
                <Button variant="outline" size="sm">Connected ✓</Button>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <div className="font-medium">📧 Custom Domain Email</div>
                  <div className="text-sm text-muted-foreground">Send emails from your domain</div>
                </div>
                <Button variant="outline" size="sm">Set up</Button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">🌐 Custom Domain</div>
                  <div className="text-sm text-muted-foreground">Use your own domain instead of studio.coop subdomain</div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
