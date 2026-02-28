'use client'

import { useState, useEffect } from 'react'
import { demoStudio } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function FormField({
  label,
  value,
  onChange,
  textarea,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  textarea?: boolean
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      )}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onToggle,
}: {
  label: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

function StatusBadge({ label, variant }: { label: string; variant: 'green' | 'yellow' }) {
  const colors = variant === 'green'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return <span className={`text-xs px-2 py-1 rounded-full font-medium ${colors}`}>{label}</span>
}

export default function DemoSettingsPage() {
  const s = demoStudio

  // General tab state
  const [studioName, setStudioName] = useState(s.name)
  const [slug, setSlug] = useState(s.slug)
  const [description, setDescription] = useState(s.description)
  const [discipline, setDiscipline] = useState(s.discipline)
  const [timezone, setTimezone] = useState(s.timezone)
  const [address, setAddress] = useState(s.settings.address)
  const [contactEmail, setContactEmail] = useState(s.settings.contactEmail)
  const [website, setWebsite] = useState(s.settings.website)
  const [brandColor, setBrandColor] = useState(s.settings.brandColor)

  // Notification toggles
  const [emailOnBooking, setEmailOnBooking] = useState(true)
  const [emailOnCancellation, setEmailOnCancellation] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(true)
  const [dailyReminder, setDailyReminder] = useState(false)

  // Cancellation policy state
  const [cancellationWindow, setCancellationWindow] = useState('24 hours')
  const [lateCancelFee, setLateCancelFee] = useState('$5.00 NZD')
  const [noShowFee, setNoShowFee] = useState('$10.00 NZD')
  const [waitlistAutoPromote, setWaitlistAutoPromote] = useState(true)

  // Save feedback
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveMessage])

  function handleSave(label: string) {
    setSaveMessage(`${label} saved!`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Studio configuration</p>
      </div>

      {/* Save feedback toast */}
      {saveMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
          {saveMessage}
        </div>
      )}

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="cancellation">Cancellation Policy</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Studio Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Studio Name" value={studioName} onChange={setStudioName} />
                <FormField label="Slug" value={slug} onChange={setSlug} />
              </div>
              <FormField label="Description" value={description} onChange={setDescription} textarea />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Discipline" value={discipline} onChange={setDiscipline} />
                <FormField label="Timezone" value={timezone} onChange={setTimezone} />
              </div>
              <FormField label="Address" value={address} onChange={setAddress} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Contact Email" value={contactEmail} onChange={setContactEmail} />
                <FormField label="Website" value={website} onChange={setWebsite} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Brand Color</label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-md border"
                    style={{ backgroundColor: brandColor }}
                  />
                  <input
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-32 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={() => handleSave('Settings')}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Email on new booking" checked={emailOnBooking} onToggle={() => setEmailOnBooking((v) => !v)} />
              <ToggleRow label="Email on cancellation" checked={emailOnCancellation} onToggle={() => setEmailOnCancellation((v) => !v)} />
              <ToggleRow label="Weekly summary email" checked={weeklySummary} onToggle={() => setWeeklySummary((v) => !v)} />
              <ToggleRow label="Daily schedule reminder" checked={dailyReminder} onToggle={() => setDailyReminder((v) => !v)} />
              <div className="pt-4">
                <Button onClick={() => handleSave('Notification preferences')}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cancellation Policy Tab */}
        <TabsContent value="cancellation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cancellation Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Cancellation window" value={cancellationWindow} onChange={setCancellationWindow} />
                <FormField label="Late cancellation fee" value={lateCancelFee} onChange={setLateCancelFee} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="No-show fee" value={noShowFee} onChange={setNoShowFee} />
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Allow waitlist auto-promote</label>
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked={waitlistAutoPromote}
                      onChange={() => setWaitlistAutoPromote((v) => !v)}
                      className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">Automatically promote from waitlist on cancellation</span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={() => handleSave('Cancellation policy')}>Save Policy</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="mt-4">
          <div className="grid gap-4">
            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Stripe</div>
                    <div className="text-sm text-muted-foreground">acct_demo_empire</div>
                  </div>
                </div>
                <StatusBadge label="Connected" variant="green" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Custom Domain</div>
                    <div className="text-sm text-muted-foreground">empire-aerial-arts.studio.coop</div>
                  </div>
                </div>
                <StatusBadge label="Active" variant="green" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Email (Resend)</div>
                    <div className="text-sm text-muted-foreground">hello@empireaerialarts.com</div>
                  </div>
                </div>
                <StatusBadge label="Configured" variant="green" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
