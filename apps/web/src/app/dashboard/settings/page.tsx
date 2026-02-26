'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SettingsPage() {
  const [studio, setStudio] = useState({
    name: 'Empire Aerial Arts', slug: 'empire-aerial',
    description: 'Wellington\'s premier aerial arts studio. Pole, silks, trapeze & more.',
    address: '123 Cuba Street', city: 'Wellington', country: 'NZ',
    timezone: 'Pacific/Auckland', phone: '', email: 'hello@empireaerial.co.nz',
    website: 'https://empireaerial.co.nz',
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

  async function handleSave() {
    setSaving(true)
    // TODO: API call
    await new Promise(r => setTimeout(r, 500))
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio configuration</p>
      </div>

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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={studio.email} onChange={e => setStudio({...studio, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={studio.phone} onChange={e => setStudio({...studio, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
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
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
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
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Notification Settings'}</Button>
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
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Policy'}</Button>
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
