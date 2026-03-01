'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, stripeApi } from '@/lib/api-client'

const DISCIPLINES = [
  'aerial', 'pole', 'yoga', 'pilates', 'dance', 'boxing', 'crossfit',
  'cycling', 'martial_arts', 'barre', 'fitness', 'wellness', 'other'
]

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const COUNTRIES = [
  { code: 'NZ', name: 'New Zealand' },
  { code: 'US', name: 'United States' },
  { code: 'AU', name: 'Australia' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'OTHER', name: 'Other' },
]

type Step = 'info' | 'stripe' | 'schedule' | 'done'

export default function SetupWizardPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [geoLoading, setGeoLoading] = useState(false)
  const [studioData, setStudioData] = useState({
    name: '', slug: '', discipline: 'aerial', description: '',
    address: '', city: '', country: 'NZ', region: '', timezone: 'Pacific/Auckland',
    latitude: '' as string | number, longitude: '' as string | number,
  })
  const [templateData, setTemplateData] = useState({
    name: '', day: 'monday', startTime: '18:00', endTime: '19:00', maxCapacity: 12,
  })

  const [createdStudioId, setCreatedStudioId] = useState<string | null>(null)

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLoading(false)
        setStudioData({
          ...studioData,
          latitude: parseFloat(position.coords.latitude.toFixed(6)),
          longitude: parseFloat(position.coords.longitude.toFixed(6)),
        })
      },
      () => {
        setGeoLoading(false)
        alert('Unable to get your location. Please check your browser permissions.')
      }
    )
  }

  async function createStudio() {
    setLoading(true)
    try {
      const payload = {
        ...studioData,
        latitude: studioData.latitude !== '' ? Number(studioData.latitude) : undefined,
        longitude: studioData.longitude !== '' ? Number(studioData.longitude) : undefined,
      }
      const result = await api.post<{ studio: { id: string } }>('/studios', payload)
      setCreatedStudioId(result.studio.id)
      setStep('stripe')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error creating studio')
    } finally {
      setLoading(false)
    }
  }

  async function connectStripe() {
    if (!createdStudioId) { setStep('schedule'); return }
    setLoading(true)
    try {
      const result = await stripeApi.onboard(createdStudioId) as { url?: string }
      if (result.url) window.location.href = result.url
      else setStep('schedule')
    } catch {
      setStep('schedule')
    } finally {
      setLoading(false)
    }
  }

  async function createFirstTemplate() {
    if (!createdStudioId) { setStep('done'); return }
    setLoading(true)
    try {
      await api.post(`/studios/${createdStudioId}/templates`, {
        name: templateData.name,
        day_of_week: DAYS.indexOf(templateData.day),
        start_time: templateData.startTime,
        end_time: templateData.endTime,
        default_capacity: templateData.maxCapacity,
      })
      setStep('done')
    } catch {
      setStep('done')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-12">
        {['info', 'stripe', 'schedule', 'done'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s ? 'bg-primary text-primary-foreground' :
              ['info', 'stripe', 'schedule', 'done'].indexOf(step) > i ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>{i + 1}</div>
            {i < 3 && <div className="w-12 h-0.5 bg-muted" />}
          </div>
        ))}
      </div>

      {step === 'info' && (
        <Card>
          <CardHeader>
            <CardTitle>Tell us about your studio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Studio Name *</label>
              <Input value={studioData.name} onChange={e => setStudioData({...studioData, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')})} placeholder="Empire Aerial Arts" />
            </div>
            <div>
              <label className="text-sm font-medium">URL Slug</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">studio.coop/</span>
                <Input value={studioData.slug} onChange={e => setStudioData({...studioData, slug: e.target.value})} placeholder="empire-aerial" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Discipline</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={studioData.discipline}
                onChange={e => setStudioData({...studioData, discipline: e.target.value})}>
                {DISCIPLINES.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea className="w-full border rounded-md px-3 py-2 text-sm min-h-[80px]" value={studioData.description}
                onChange={e => setStudioData({...studioData, description: e.target.value})} placeholder="What makes your studio special?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">City</label>
                <Input value={studioData.city} onChange={e => setStudioData({...studioData, city: e.target.value})} placeholder="Wellington" />
              </div>
              <div>
                <label className="text-sm font-medium">Region / State</label>
                <Input value={studioData.region} onChange={e => setStudioData({...studioData, region: e.target.value})} placeholder="Wellington" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Country</label>
              <select className="w-full border rounded-md px-3 py-2 text-sm" value={studioData.country}
                onChange={e => setStudioData({...studioData, country: e.target.value})}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Location Coordinates</label>
                <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation} disabled={geoLoading}>
                  {geoLoading ? 'Locating...' : 'Use My Location'}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Latitude</label>
                  <Input type="number" step="any" value={studioData.latitude} onChange={e => setStudioData({...studioData, latitude: e.target.value})} placeholder="-41.2865" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Longitude</label>
                  <Input type="number" step="any" value={studioData.longitude} onChange={e => setStudioData({...studioData, longitude: e.target.value})} placeholder="174.7762" />
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={createStudio} disabled={!studioData.name || loading}>
              {loading ? 'Creating...' : 'Create Studio \u{2192}'}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'stripe' && (
        <Card>
          <CardHeader>
            <CardTitle>Connect Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Connect your Stripe account to accept payments from members. You can skip this and set it up later.</p>
            <div className="flex gap-3">
              <Button onClick={connectStripe} disabled={loading}>
                {loading ? 'Connecting...' : '\u{1F4B3}\u0020Connect Stripe'}
              </Button>
              <Button variant="outline" onClick={() => setStep('schedule')}>Skip for now</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'schedule' && (
        <Card>
          <CardHeader>
            <CardTitle>Create your first class</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Set up a recurring class to get started. You can add more later.</p>
            <div>
              <label className="text-sm font-medium">Class Name</label>
              <Input value={templateData.name} onChange={e => setTemplateData({...templateData, name: e.target.value})} placeholder="Beginner Aerial Silks" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Day</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={templateData.day}
                  onChange={e => setTemplateData({...templateData, day: e.target.value})}>
                  {DAYS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Start</label>
                <Input type="time" value={templateData.startTime} onChange={e => setTemplateData({...templateData, startTime: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">End</label>
                <Input type="time" value={templateData.endTime} onChange={e => setTemplateData({...templateData, endTime: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Max Capacity</label>
              <Input type="number" value={templateData.maxCapacity} onChange={e => setTemplateData({...templateData, maxCapacity: parseInt(e.target.value) || 12})} />
            </div>
            <div className="flex gap-3">
              <Button onClick={createFirstTemplate} disabled={!templateData.name || loading}>
                {loading ? 'Creating...' : '\u{1F4C5}\u0020Create Class'}
              </Button>
              <Button variant="outline" onClick={() => setStep('done')}>Skip</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'done' && (
        <Card>
          <CardHeader>
            <CardTitle>{'\u{1F389}'} You&apos;re all set!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Your studio is ready. Here&apos;s what to do next:</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">{'\u2705'} Studio created</div>
              <div className="flex items-center gap-2 text-sm">{'\u2192'} Invite your members</div>
              <div className="flex items-center gap-2 text-sm">{'\u2192'} Set up your class schedule</div>
              <div className="flex items-center gap-2 text-sm">{'\u2192'} Create membership plans</div>
              <div className="flex items-center gap-2 text-sm">{'\u2192'} Share your studio page</div>
            </div>
            <Button className="w-full" onClick={() => router.push('/dashboard')}>Go to Dashboard \u2192</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
