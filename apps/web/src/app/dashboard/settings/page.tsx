'use client'

import { useEffect, useState } from 'react'
import { studioApi, stripeApi, memberApi, skillApi } from '@/lib/api-client'
import type { PrivacySettings } from '@/lib/api-client'
import { useStudioId } from '@/hooks/use-studio-id'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const COUNTRIES = [
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'OTHER', name: 'Other' },
]

export default function SettingsPage() {
  const { studioId, loading: studioLoading } = useStudioId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const [studio, setStudio] = useState({
    name: '', slug: '', description: '',
    address: '', city: '', country: '', region: '',
    timezone: 'Pacific/Auckland', phone: '', email: '', website: '',
    latitude: '' as string | number, longitude: '' as string | number,
  })

  const [notifications, setNotifications] = useState({
    booking_confirmation: true, booking_reminder: true, reminder_hours: 2,
    cancellation_notice: true, waitlist_available: true,
    class_cancelled: true, new_member_welcome: true,
    marketing_emails: false,
    // API-backed settings (camelCase keys)
    confirmationEnabled: true,
    reengagementEnabled: true,
    reengagementDays: 14,
    feedNotifications: true,
  })

  const [cancellation, setCancellation] = useState({
    hours_before: 12, late_cancel_fee_cents: 0, no_show_fee_cents: 0,
    allow_self_cancel: true,
  })

  const [waitlist, setWaitlist] = useState({
    autoPromote: true,
    confirmationMinutes: 60,
    maxSize: 0,
    notifyPosition: true,
  })

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    profile_visibility: 'members',
    show_attendance: true,
    show_email: false,
    show_phone: false,
    show_achievements: true,
    feed_posts_visible: true,
  })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Skills management state
  interface SkillDef { id: string; name: string; category: string; description: string | null; sort_order: number }
  const [skillDefs, setSkillDefs] = useState<SkillDef[]>([])
  const [skillsGrouped, setSkillsGrouped] = useState<Record<string, SkillDef[]>>({})
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('')
  const [newSkillDescription, setNewSkillDescription] = useState('')
  const [skillSaving, setSkillSaving] = useState(false)
  const [skillError, setSkillError] = useState<string | null>(null)
  const [skillSuccess, setSkillSuccess] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const [stripeStatus, setStripeStatus] = useState<{ connected: boolean; accountId?: string; dashboardUrl?: string }>({ connected: false })
  const [stripeLoading, setStripeLoading] = useState(false)

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    setGeoError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false)
        setStudio({
          ...studio,
          latitude: parseFloat(position.coords.latitude.toFixed(6)),
          longitude: parseFloat(position.coords.longitude.toFixed(6)),
        })
      },
      () => {
        setGeoLoading(false)
        setGeoError('Unable to get your location. Please check your browser permissions.')
      }
    )
  }

  useEffect(() => {
    if (studioLoading) return
    if (!studioId) { setLoading(false); return }

    const sid = studioId

    async function load() {
      try {
        const settings = await studioApi.getSettings(sid)
        const g = settings.general as Record<string, string>
        setStudio({
          name: g.name ?? '', slug: g.slug ?? '', description: g.description ?? '',
          address: g.address ?? '', city: g.city ?? '', country: g.country ?? '',
          region: g.region ?? '',
          timezone: g.timezone ?? 'Pacific/Auckland', phone: g.phone ?? '',
          email: g.email ?? '', website: g.website ?? '',
          latitude: g.latitude ?? '', longitude: g.longitude ?? '',
        })
        const n = settings.notifications as Record<string, unknown>
        setNotifications(prev => ({ ...prev, ...n }))
        const ca = settings.cancellation as Record<string, unknown>
        setCancellation(prev => ({ ...prev, ...ca }))
        const wl = settings.waitlist as Record<string, unknown>
        if (wl) setWaitlist(prev => ({ ...prev, ...wl }))
        // Fetch Stripe status
        try {
          const status = await stripeApi.status(sid)
          setStripeStatus(status)
        } catch {
          // Stripe not configured
        }
        // Fetch privacy settings for current user
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setCurrentUserId(user.id)
            const privacySettings = await memberApi.getPrivacy(sid, user.id)
            setPrivacy(privacySettings)
          }
        } catch {
          // Privacy settings not available
        }
        // Fetch skill definitions
        try {
          const skillResult = await skillApi.list(sid)
          setSkillDefs(skillResult.skills ?? [])
          setSkillsGrouped(skillResult.grouped ?? {})
        } catch {
          // skills table may not exist yet
        }
      } catch {
        setError('Failed to load settings. Please try again.')
      }
      setLoading(false)
    }
    load()
  }, [studioId, studioLoading])

  async function handleAddSkill() {
    if (!studioId || !newSkillName.trim() || !newSkillCategory.trim()) return
    setSkillSaving(true)
    setSkillError(null)
    setSkillSuccess(null)
    try {
      const result = await skillApi.create(studioId, {
        name: newSkillName.trim(),
        category: newSkillCategory.trim(),
        description: newSkillDescription.trim() || undefined,
      })
      const newSkill = result.skill
      setSkillDefs((prev) => [...prev, newSkill])
      setSkillsGrouped((prev) => {
        const cat = newSkill.category
        return { ...prev, [cat]: [...(prev[cat] ?? []), newSkill] }
      })
      setNewSkillName('')
      setNewSkillDescription('')
      setSkillSuccess('Skill added!')
      setTimeout(() => setSkillSuccess(null), 3000)
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : 'Failed to add skill')
    } finally {
      setSkillSaving(false)
    }
  }

  async function handleDeleteSkill(skillId: string) {
    if (!studioId) return
    try {
      await skillApi.delete(studioId, skillId)
      setSkillDefs((prev) => prev.filter((s) => s.id !== skillId))
      setSkillsGrouped((prev) => {
        const updated = { ...prev }
        for (const cat of Object.keys(updated)) {
          updated[cat] = updated[cat].filter((s) => s.id !== skillId)
          if (updated[cat].length === 0) delete updated[cat]
        }
        return updated
      })
    } catch {
      setSkillError('Failed to delete skill')
    }
  }

  async function handleSeedSkills() {
    if (!studioId) return
    setSeeding(true)
    setSkillError(null)
    try {
      const result = await skillApi.seed(studioId)
      if (result.seeded > 0) {
        // Refetch to get latest
        const refreshed = await skillApi.list(studioId)
        setSkillDefs(refreshed.skills ?? [])
        setSkillsGrouped(refreshed.grouped ?? {})
        setSkillSuccess(`Seeded ${result.seeded} default skills!`)
        setTimeout(() => setSkillSuccess(null), 3000)
      } else {
        setSkillSuccess('No new skills to seed (defaults already exist).')
        setTimeout(() => setSkillSuccess(null), 3000)
      }
    } catch (e) {
      setSkillError(e instanceof Error ? e.message : 'Failed to seed skills')
    } finally {
      setSeeding(false)
    }
  }

  async function handleSaveGeneral() {
    if (!studioId) return
    setSaving(true)
    setSaveMessage('')
    try {
      const payload = {
        ...studio,
        latitude: studio.latitude !== '' ? Number(studio.latitude) : undefined,
        longitude: studio.longitude !== '' ? Number(studio.longitude) : undefined,
      }
      await studioApi.updateGeneral(studioId, payload)
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

  async function handleSaveWaitlist() {
    if (!studioId) return
    setSaving(true)
    setSaveMessage('')
    try {
      await studioApi.updateWaitlist(studioId, waitlist)
      setSaveMessage('Waitlist settings saved!')
    } catch (e) {
      setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save'}`)
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  async function handleSavePrivacy() {
    if (!studioId || !currentUserId) return
    setSaving(true)
    setSaveMessage('')
    try {
      const updated = await memberApi.updatePrivacy(studioId, currentUserId, privacy)
      setPrivacy(updated)
      setSaveMessage('Privacy settings saved!')
    } catch (e) {
      setSaveMessage(`Error: ${e instanceof Error ? e.message : 'Failed to save'}`)
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(''), 3000)
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground" aria-busy="true" role="status">Loading settings...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio configuration</p>
      </div>

      {error && (
        <div role="alert" className="text-sm px-4 py-3 rounded-md bg-red-50 text-red-700">{error}</div>
      )}

      {saveMessage && (
        <div role={saveMessage.startsWith('Error') ? 'alert' : 'status'} aria-live={saveMessage.startsWith('Error') ? 'assertive' : 'polite'} className={`text-sm px-4 py-2 rounded-md ${saveMessage.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-100 text-emerald-900'}`}>
          {saveMessage}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="general" className="min-h-[44px] touch-manipulation">General</TabsTrigger>
          <TabsTrigger value="notifications" className="min-h-[44px] touch-manipulation">Notifications</TabsTrigger>
          <TabsTrigger value="cancellation" className="min-h-[44px] touch-manipulation">Cancellation</TabsTrigger>
          <TabsTrigger value="waitlist" className="min-h-[44px] touch-manipulation">Waitlist</TabsTrigger>
          <TabsTrigger value="privacy" className="min-h-[44px] touch-manipulation">Privacy</TabsTrigger>
          <TabsTrigger value="skills" className="min-h-[44px] touch-manipulation">Skills</TabsTrigger>
          <TabsTrigger value="integrations" className="min-h-[44px] touch-manipulation">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Studio Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studio-name" className="text-sm font-medium">Studio Name</label>
                  <Input id="studio-name" value={studio.name} onChange={e => setStudio({...studio, name: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="studio-slug" className="text-sm font-medium">URL Slug</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">studio.coop/</span>
                    <Input id="studio-slug" value={studio.slug} onChange={e => setStudio({...studio, slug: e.target.value})} />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="studio-description" className="text-sm font-medium">Description</label>
                <textarea id="studio-description" className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]"
                  value={studio.description} onChange={e => setStudio({...studio, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studio-email" className="text-sm font-medium">Email</label>
                  <Input id="studio-email" value={studio.email} onChange={e => setStudio({...studio, email: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="studio-phone" className="text-sm font-medium">Phone</label>
                  <Input id="studio-phone" value={studio.phone} onChange={e => setStudio({...studio, phone: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studio-address" className="text-sm font-medium">Address</label>
                  <Input id="studio-address" value={studio.address} onChange={e => setStudio({...studio, address: e.target.value})} />
                </div>
                <div>
                  <label htmlFor="studio-city" className="text-sm font-medium">City</label>
                  <Input id="studio-city" value={studio.city} onChange={e => setStudio({...studio, city: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="studio-region" className="text-sm font-medium">Region / State</label>
                  <Input id="studio-region" value={studio.region} onChange={e => setStudio({...studio, region: e.target.value})} placeholder="e.g. Wellington, California" />
                </div>
                <div>
                  <label htmlFor="studio-country" className="text-sm font-medium">Country</label>
                  <select id="studio-country" className="w-full border rounded-md px-3 py-2 text-sm h-10" value={studio.country}
                    onChange={e => setStudio({...studio, country: e.target.value})}>
                    <option value="">Select country...</option>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="studio-timezone" className="text-sm font-medium">Timezone</label>
                  <Input id="studio-timezone" value={studio.timezone} onChange={e => setStudio({...studio, timezone: e.target.value})} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Location Coordinates</label>
                  <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation} disabled={geoLoading}>
                    {geoLoading ? 'Locating...' : 'Use My Location'}
                  </Button>
                </div>
                {geoError && (
                  <p role="alert" className="text-sm text-red-600">{geoError}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="studio-latitude" className="text-xs text-muted-foreground">Latitude</label>
                    <Input id="studio-latitude" type="number" step="any" value={studio.latitude} onChange={e => setStudio({...studio, latitude: e.target.value})} placeholder="-41.2865" />
                  </div>
                  <div>
                    <label htmlFor="studio-longitude" className="text-xs text-muted-foreground">Longitude</label>
                    <Input id="studio-longitude" type="number" step="any" value={studio.longitude} onChange={e => setStudio({...studio, longitude: e.target.value})} placeholder="174.7762" />
                  </div>
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
                    <div className="font-medium text-sm" id={`notif-label-${item.key}`}>{item.label}</div>
                    <div className="text-xs text-muted-foreground" id={`notif-desc-${item.key}`}>{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={notifications[item.key as keyof typeof notifications] as boolean}
                      onChange={e => setNotifications({...notifications, [item.key]: e.target.checked})}
                      aria-labelledby={`notif-label-${item.key}`}
                      aria-describedby={`notif-desc-${item.key}`}
                      role="switch"
                      aria-checked={notifications[item.key as keyof typeof notifications] as boolean} />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
              {notifications.booking_reminder && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <label htmlFor="reminder-hours" className="text-sm font-medium">Remind how many hours before?</label>
                  <Input id="reminder-hours" type="number" className="w-24 mt-1" value={notifications.reminder_hours}
                    onChange={e => setNotifications({...notifications, reminder_hours: parseInt(e.target.value) || 2})} />
                </div>
              )}

              <div className="pt-4 border-t">
                <h3 className="font-medium text-sm mb-3">Re-engagement & Feed</h3>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium text-sm" id="reengagement-label">&ldquo;We miss you&rdquo; messages</div>
                  <div className="text-xs text-muted-foreground" id="reengagement-desc">Send re-engagement emails to inactive members</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={notifications.reengagementEnabled}
                    onChange={e => setNotifications({...notifications, reengagementEnabled: e.target.checked})}
                    aria-labelledby="reengagement-label"
                    aria-describedby="reengagement-desc"
                    role="switch"
                    aria-checked={notifications.reengagementEnabled} />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              {notifications.reengagementEnabled && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <label htmlFor="reengagement-days" className="text-sm font-medium">Days inactive before sending</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input id="reengagement-days" type="number" className="w-24" min={3} max={90}
                      value={notifications.reengagementDays}
                      onChange={e => setNotifications({...notifications, reengagementDays: parseInt(e.target.value) || 14})} />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Members who haven&apos;t attended in {notifications.reengagementDays} days will receive a re-engagement message
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <div className="font-medium text-sm" id="feed-notif-label">Class feed notifications</div>
                  <div className="text-xs text-muted-foreground" id="feed-notif-desc">Notify members when new posts appear in their class feeds</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={notifications.feedNotifications}
                    onChange={e => setNotifications({...notifications, feedNotifications: e.target.checked})}
                    aria-labelledby="feed-notif-label"
                    aria-describedby="feed-notif-desc"
                    role="switch"
                    aria-checked={notifications.feedNotifications} />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <Button onClick={handleSaveNotifications} disabled={saving}>{saving ? 'Saving...' : 'Save Notification Settings'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cancellation" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Cancellation Policy</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="cancel-hours" className="text-sm font-medium">Cancellation window (hours before class)</label>
                <Input id="cancel-hours" type="number" className="w-32 mt-1" value={cancellation.hours_before}
                  onChange={e => setCancellation({...cancellation, hours_before: parseInt(e.target.value) || 0})} />
                <p className="text-xs text-muted-foreground mt-1">
                  Members must cancel at least {cancellation.hours_before} hours before class starts
                </p>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-sm" id="self-cancel-label">Allow self-cancellation</div>
                  <div className="text-xs text-muted-foreground" id="self-cancel-desc">Members can cancel their own bookings</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={cancellation.allow_self_cancel}
                    onChange={e => setCancellation({...cancellation, allow_self_cancel: e.target.checked})}
                    role="switch"
                    aria-checked={cancellation.allow_self_cancel}
                    aria-labelledby="self-cancel-label"
                    aria-describedby="self-cancel-desc" />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <div>
                <label htmlFor="late-cancel-fee" className="text-sm font-medium">Late cancellation fee (NZ$)</label>
                <Input id="late-cancel-fee" type="number" step="0.01" className="w-32 mt-1" value={cancellation.late_cancel_fee_cents / 100}
                  onChange={e => setCancellation({...cancellation, late_cancel_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100)})} />
              </div>
              <div>
                <label htmlFor="no-show-fee" className="text-sm font-medium">No-show fee (NZ$)</label>
                <Input id="no-show-fee" type="number" step="0.01" className="w-32 mt-1" value={cancellation.no_show_fee_cents / 100}
                  onChange={e => setCancellation({...cancellation, no_show_fee_cents: Math.round(parseFloat(e.target.value || '0') * 100)})} />
              </div>
              <Button onClick={handleSaveCancellation} disabled={saving}>{saving ? 'Saving...' : 'Save Policy'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="waitlist" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Waitlist Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium text-sm" id="auto-promote-label">Auto-promote from waitlist</div>
                  <div className="text-xs text-muted-foreground" id="auto-promote-desc">Automatically move the next person off the waitlist when a spot opens</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={waitlist.autoPromote}
                    onChange={e => setWaitlist({...waitlist, autoPromote: e.target.checked})}
                    role="switch"
                    aria-checked={waitlist.autoPromote}
                    aria-labelledby="auto-promote-label"
                    aria-describedby="auto-promote-desc" />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              {waitlist.autoPromote && (
                <div className="pl-4 border-l-2 border-primary/20">
                  <label htmlFor="confirmation-minutes" className="text-sm font-medium">Confirmation window</label>
                  <div className="flex items-center gap-2 mt-1">
                    <select id="confirmation-minutes" className="border rounded-md px-3 py-2 text-sm h-10"
                      value={waitlist.confirmationMinutes}
                      onChange={e => setWaitlist({...waitlist, confirmationMinutes: parseInt(e.target.value)})}>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    How long a promoted member has to confirm before the spot goes to the next person
                  </p>
                </div>
              )}
              <div className="pt-2">
                <label htmlFor="max-waitlist-size" className="text-sm font-medium">Maximum waitlist size per class</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="max-waitlist-size" type="number" className="w-24" min={0}
                    value={waitlist.maxSize}
                    onChange={e => setWaitlist({...waitlist, maxSize: parseInt(e.target.value) || 0})} />
                  <span className="text-sm text-muted-foreground">members</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Set to 0 for unlimited waitlist size
                </p>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <div>
                  <div className="font-medium text-sm" id="notify-position-label">Show waitlist position</div>
                  <div className="text-xs text-muted-foreground" id="notify-position-desc">Tell waitlisted members their position in line</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={waitlist.notifyPosition}
                    onChange={e => setWaitlist({...waitlist, notifyPosition: e.target.checked})}
                    role="switch"
                    aria-checked={waitlist.notifyPosition}
                    aria-labelledby="notify-position-label"
                    aria-describedby="notify-position-desc" />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
              <Button onClick={handleSaveWaitlist} disabled={saving}>{saving ? 'Saving...' : 'Save Waitlist Settings'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Privacy Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Control what other studio members can see about you. Staff and studio owners always have full access.</p>

              <div className="py-2 border-b">
                <label htmlFor="profile-visibility" className="text-sm font-medium block mb-1">Profile Visibility</label>
                <p className="text-xs text-muted-foreground mb-2">Who can view your profile</p>
                <select
                  id="profile-visibility"
                  className="border rounded-md px-3 py-2 text-sm h-10"
                  value={privacy.profile_visibility}
                  onChange={e => setPrivacy({ ...privacy, profile_visibility: e.target.value as PrivacySettings['profile_visibility'] })}
                >
                  <option value="everyone">Everyone</option>
                  <option value="members">Studio Members Only</option>
                  <option value="staff_only">Staff Only</option>
                </select>
              </div>

              {[
                { key: 'show_attendance' as const, label: 'Show attendance history', desc: 'Let other members see your class attendance' },
                { key: 'show_email' as const, label: 'Show email to other members', desc: 'Make your email visible on your profile' },
                { key: 'show_phone' as const, label: 'Show phone to other members', desc: 'Make your phone number visible on your profile' },
                { key: 'show_achievements' as const, label: 'Show achievements', desc: 'Let other members see your achievements and milestones' },
                { key: 'feed_posts_visible' as const, label: 'Show feed posts to non-attendees', desc: 'Allow studio members who were not in the class to see your feed posts' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="font-medium text-sm" id={`privacy-label-${item.key}`}>{item.label}</div>
                    <div className="text-xs text-muted-foreground" id={`privacy-desc-${item.key}`}>{item.desc}</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={privacy[item.key]}
                      onChange={e => setPrivacy({ ...privacy, [item.key]: e.target.checked })}
                      aria-labelledby={`privacy-label-${item.key}`}
                      aria-describedby={`privacy-desc-${item.key}`}
                      role="switch"
                      aria-checked={privacy[item.key]} />
                    <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}

              <Button onClick={handleSavePrivacy} disabled={saving}>{saving ? 'Saving...' : 'Save Privacy Settings'}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Skill Definitions</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSeedSkills}
                  disabled={seeding}
                >
                  {seeding ? 'Seeding...' : 'Seed Default Skills'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Define the skills members can track their progression on. Skills are grouped by category.
              </p>

              {skillError && (
                <div role="alert" className="text-sm px-4 py-2 rounded-md bg-red-50 text-red-700">{skillError}</div>
              )}
              {skillSuccess && (
                <div role="status" className="text-sm px-4 py-2 rounded-md bg-emerald-100 text-emerald-900">{skillSuccess}</div>
              )}

              {/* Add skill form */}
              <div className="border rounded-lg p-4 space-y-3 bg-secondary/30">
                <h3 className="font-medium text-sm">Add Skill</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="skill-name" className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <Input
                      id="skill-name"
                      type="text"
                      placeholder="e.g. Basic Spin"
                      value={newSkillName}
                      onChange={(e) => setNewSkillName(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label htmlFor="skill-category" className="text-xs text-muted-foreground mb-1 block">Category *</label>
                    <Input
                      id="skill-category"
                      type="text"
                      placeholder="e.g. Spins, Inverts, Flexibility"
                      value={newSkillCategory}
                      onChange={(e) => setNewSkillCategory(e.target.value)}
                      maxLength={50}
                      list="skill-categories"
                    />
                    <datalist id="skill-categories">
                      {Object.keys(skillsGrouped).map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <div>
                  <label htmlFor="skill-description" className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                  <Input
                    id="skill-description"
                    type="text"
                    placeholder="Brief description of this skill"
                    value={newSkillDescription}
                    onChange={(e) => setNewSkillDescription(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAddSkill}
                  disabled={skillSaving || !newSkillName.trim() || !newSkillCategory.trim()}
                >
                  {skillSaving ? 'Adding...' : 'Add Skill'}
                </Button>
              </div>

              {/* Current skills grouped by category */}
              {Object.keys(skillsGrouped).length === 0 && (
                <p className="text-sm text-muted-foreground">No skills defined yet. Add skills above or use &ldquo;Seed Default Skills&rdquo; to get started.</p>
              )}

              {Object.entries(skillsGrouped).map(([category, skills]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-2">{category}</h3>
                  <div className="space-y-1">
                    {skills.map((skill) => (
                      <div key={skill.id} className="flex items-center justify-between py-2 px-3 border rounded-md">
                        <div>
                          <span className="text-sm font-medium">{skill.name}</span>
                          {skill.description && (
                            <span className="text-xs text-muted-foreground ml-2">{skill.description}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                          onClick={() => handleDeleteSkill(skill.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
                      <span className="inline-flex items-center gap-1.5 text-sm text-white bg-emerald-700 px-2.5 py-1 rounded-full font-semibold">
                        <span className="w-2 h-2 rounded-full bg-emerald-300" aria-hidden="true" />
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
                          } catch (err) {
                            console.error('Failed to generate Stripe refresh link:', err)
                            setSaveMessage('Error: Failed to generate Stripe link. Please try again.')
                            setTimeout(() => setSaveMessage(''), 3000)
                          }
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
