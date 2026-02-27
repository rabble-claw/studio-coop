'use client'

import { demoStudio } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function FormField({ label, value, textarea }: { label: string; value: string; textarea?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea
          disabled
          value={value}
          rows={3}
          className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm disabled:opacity-70"
        />
      ) : (
        <input
          disabled
          value={value}
          className="w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm disabled:opacity-70"
        />
      )}
    </div>
  )
}

function ToggleRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted'
        } opacity-70`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Studio configuration</p>
      </div>

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
                <FormField label="Studio Name" value={s.name} />
                <FormField label="Slug" value={s.slug} />
              </div>
              <FormField label="Description" value={s.description} textarea />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Discipline" value={s.discipline} />
                <FormField label="Timezone" value={s.timezone} />
              </div>
              <FormField label="Address" value={s.settings.address} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Contact Email" value={s.settings.contactEmail} />
                <FormField label="Website" value={s.settings.website} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Brand Color</label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-md border"
                    style={{ backgroundColor: s.settings.brandColor }}
                  />
                  <input
                    disabled
                    value={s.settings.brandColor}
                    className="w-32 rounded-lg border bg-muted/50 px-3 py-2 text-sm disabled:opacity-70"
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button disabled>Save Changes</Button>
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
              <ToggleRow label="Email on new booking" checked={true} />
              <ToggleRow label="Email on cancellation" checked={true} />
              <ToggleRow label="Weekly summary email" checked={true} />
              <ToggleRow label="Daily schedule reminder" checked={false} />
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
                <FormField label="Cancellation window" value="24 hours" />
                <FormField label="Late cancellation fee" value="$5.00 NZD" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="No-show fee" value="$10.00 NZD" />
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Allow waitlist auto-promote</label>
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      checked
                      disabled
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-muted-foreground">Automatically promote from waitlist on cancellation</span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <Button disabled>Save Policy</Button>
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
