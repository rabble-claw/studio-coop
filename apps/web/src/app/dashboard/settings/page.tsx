'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { studioApi, stripeApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SettingsPage() {
  const [studioId, setStudioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [studio, setStudio] = useState({
    name: '', slug: '', description: '',
    address: '', city: '', country: '',
    timezone: 'Pacific/Auckland', phone: '', email: '', website: '',
  })

  const [notifications, setNotifications] = useState({
    booking_confirmation: true, booking_reminder: true, reminder_hours: 2,
    cancellation_notice: true, waitlist_available: true,
    class_cancelled: true, new_member_welcome: true,
    marketing_emails: false,
  })

  const [cancellation, setCancellation] = useState({
    hours_before: 12, late_cancel_fee_cents: 0, no_show_fee_cents: 0,
    allow_self_cancel: true,
  })

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; accountId?: string; dashboardUrl?: string }>({ connected: false })
  const [stripeLoading, setStripeLoading] = useState(false)

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

      try {
        const settings = await studioApi.getSettings(membership.studio_id)
        const g = settings.general as Record<string, string>
        setStudio({
          name: g.name ?? '', slug: g.slug ?? '', description: g.description ?? '',
          address: g.address ?? '', city: g.city ?? '', country: g.country ?? '',
          timezone: g.timezone ?? 'Pacific/Auckland', phone: g.phone ?? '',
          email: g.email ?? '', website: g.website ?? '',
        })
        const n = settings.notifications as Record<string, unknown>
        setNotifications(prev => ({ ...prev, ...n }))
        const ca = settings.cancellation as Record<string, unknown>
        setCancellation(prev => ({ ...prev, ...ca }))
        // Fetch Stripe status
        try {
          const status = await stripeApi.status(membership.studio_id)
          setStripeStatus(status)
        } catch {
          // Stripe not configured
        }
      } catch {
        // Fall through to defaults if API not reachable
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveGeneral() {
    if (!studioId) return
    setSaving(true)
    setSaveMessage('')
    try {
      await studioApi.updateGeneral(studioId, studio)
      setSaveMessage('Settings saved!')
    } catch (e) {
      setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save'}`)
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  async function handleSaveNotifications() {
    if (!studioId) return
    setSaving(true)
    setSaveMessage('')
    try {
      await studioApi.updateNotifications(studioId, notifications)
      setSaveMessage('Notification settings saved!')
    } catch (e) {
      setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save'}`)
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  async function handleSaveCancellation() {
    if (!studioId) return
    setSaving(true)
    setSaveMessage('')
    try {
      await studioApi.updateCancellation(studioId, cancellation)
      setSaveMessage('Cancellation policy saved!')
    } catch (e) {
      setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save'}`)
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading settings...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio configuration</p>
      </div>

      {saveMessage && (
        <div className={`text-sm px-4 py-2 rounded-md ${saveMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {saveMessage}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general" className="min-h-[44px] touch-manipulation">General</TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-[44px] touch-manipulation">Notifications</TabsTrigger>
          <TabsTrigger value="cancellation" className="min-h-[44px] touch-manipulation">Cancellation</TabsTrigger>
          <TabsTrigger value="integrations" className="min-h-[44px] touch-manipulation">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Studio Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Studio Name</label>
                  <Input value={studio.name} onChange={e => setStudio({...studio, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">URL Slug</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">studio.coop/</span>
                    <Input value={studio.slug} onChange={e => setStudio({...studio, slug: e.target.value})} />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                  value={studio.description} onChange={e => setStudio({...studio, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={studio.email} onChange={e => setStudio({...studio, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={studio.phone} onChange={e => setStudio({...studio, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Address</label>
                  <Input value={studio.address} onChange={e => setStudio({...studio, address: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">City</label>
                  <Input value={studio.city} onChange={e => setStudio({...studio, city: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Timezone</label>
                  <Input value={studio.timezone} onChange={e => setStudio({...studio, timezone: e.target.value})} />
                </div>
              </div>
              <Button onClick={handleSaveGeneral} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Notification Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'booking_confirmation', label: 'Booking confirmations', desc: 'Email members when they book a class' },
                { key: 'booking_reminder', label: 'Booking reminders', desc: 'Remind members before class' },
                { key: 'cancellation_notice', label: 'Cancellation notices', desc: 'Notify when a class is cancelled' },
                { key: 'waitlist_available', label: 'Waitlist notifications', desc: 'Notify when a spot opens up' },
                { key: 'class_cancelled', label: 'Class cancellation alerts', desc: 'Notify all booked members' },
                { key: 'new_member_welcome', label: 'Welcome emails', desc: 'Send welcome email to new members' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={notifications[item.key as keyof typeof notifications] as boolean}
                      onChange={e => setNotifications({...notifications, [item.key]: e.target.checked})} />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
              {notifications.booking_reminder && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <label className="text-sm font-medium">Remind how many hours before?</label>
                  <Input type="number" className="w-24 mt-1" value={notifications.reminder_hours}
                    onChange={e => setNotifications({...notifications, reminder_hours: parseInt(e.target.value) || 2})} />
                </div>
              )}
              <Button onClick={handleSaveNotifications} disabled={saving}>{saving ? 'Saving...' : 'Save Notification Settings'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancellation" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Cancellation Policy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cancellation window (hours before class)</label>
                <Input type="number" className="w-32 mt-1" value={cancellation.hours_before}
                  onChange={e => setCancellation({...cancellation, hours_before: parseInt(e.target.value) || 0})} />
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
                  <input type="checkbox" className="sr-only peer" checked={cancellation.allow_self_cancel}
                    onChange={e => setCancellation({...cancellation, allow_self_cancel: e.target.checked})} />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div>
                <label className="text-sm font-medium">Late cancellation fee ($NZD)</label>
                <Input type="number" step="0.01" className="w-32 mt-1" value={cancellation.late_cancel_fee_cents / 100}
                  onChange={e => setCancellation({...cancellation, late_cancel_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100)})} />
              </div>
              <div>
                <label className="text-sm font-medium">No-show fee ($NZD)</label>
                <Input type="number" step="0.01" className="w-32 mt-1" value={cancellation.no_show_fee_cents / 100}
                  onChange={e => setCancellation({...cancellation, no_show_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100)})} />
              </div>
              <Button onClick={handleSaveCancellation} disabled={saving}>{saving ? 'Saving...' : 'Save Policy'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <div className="font-medium">Stripe</div>
                  <div className="text-sm text-muted-foreground">Accept payments from members</div>
                </div>
                <div className="flex items-center gap-2">
                  {stripeStatus.connected ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        Connected
                      </span>
                      {stripeStatus.dashboardUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={stripeStatus.dashboardUrl} target="_blank" rel="noopener noreferrer">
                            Stripe Dashboard
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={stripeLoading}
                        onClick={async () => {
                          if (!studioId) return
                          setStripeLoading(true)
                          try {
                            const result = await stripeApi.refreshLink(studioId)
                            if (result.url) window.open(result.url, '_blank')
                          } catch { /* ignore */ }
                          setStripeLoading(false)
                        }}
                      >
                        {stripeLoading ? 'Loading...' : 'Refresh Link'}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      disabled={stripeLoading}
                      onClick={async () => {
                        if (!studioId) return
                        setStripeLoading(true)
                        try {
                          const result = await stripeApi.onboard(studioId) as { url?: string }
                          if (result.url) window.location.href = result.url
                        } catch (e) {
                          setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to connect Stripe'}`)
                          setTimeout(() => setSaveMessage(''), 3000)
                        }
                        setStripeLoading(false)
                      }}
                    >
                      {stripeLoading ? 'Connecting...' : 'Connect Stripe'}
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b">
                <div>
                  <div className="font-medium">Custom Domain Email</div>
                  <div className="text-sm text-muted-foreground">Send emails from your domain</div>
                </div>
                <Button variant="outline" size="sm" disabled>Coming soon</Button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">Custom Domain</div>
                  <div className="text-sm text-muted-foreground">Use your own domain instead of studio.coop subdomain</div>
                </div>
                <Button variant="outline" size="sm" disabled>Coming soon</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
