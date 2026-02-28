'use client'

import { useState } from 'react'
import { demoNetworks, demoNetworkMembers, demoNetworkStats } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function getPolicyBadge(policy: string) {
  switch (policy) {
    case 'included':
      return <Badge className="bg-green-100 text-green-800">Included</Badge>
    case 'discounted':
      return <Badge className="bg-amber-100 text-amber-800">Discounted</Badge>
    case 'full_price':
      return <Badge className="bg-gray-100 text-gray-700">Full Price</Badge>
    default:
      return null
  }
}

export default function DemoNetworkPage() {
  const network = demoNetworks[0]!
  const [toast, setToast] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [configPolicy, setConfigPolicy] = useState('discounted')
  const [configDiscount, setConfigDiscount] = useState('15')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-card border rounded-lg shadow-lg px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{network.name}</h1>
          <p className="text-muted-foreground">{network.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowConfigModal(true)}>Configure</Button>
          <Button variant="outline" onClick={() => setShowInviteModal(true)}>Invite Studio</Button>
          <Button onClick={() => showToast('You are already a member of this network.')}>Join Network</Button>
        </div>
      </div>

      {/* Invite Studio Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowInviteModal(false)}>
          <div className="bg-card rounded-lg shadow-lg border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Invite Studio to Network</h2>
            <div>
              <label className="text-sm font-medium">Studio contact email</label>
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="e.g. owner@anotherstudio.com"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowInviteModal(false); setInviteEmail('') }}>Cancel</Button>
              <Button
                disabled={!inviteEmail.trim()}
                onClick={() => {
                  showToast(`Invitation sent to ${inviteEmail}`)
                  setInviteEmail('')
                  setShowInviteModal(false)
                }}
              >
                Send Invite
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Configure Network Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowConfigModal(false)}>
          <div className="bg-card rounded-lg shadow-lg border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Network Settings</h2>
            <div>
              <label className="text-sm font-medium">Cross-Booking Policy</label>
              <select
                value={configPolicy}
                onChange={(e) => setConfigPolicy(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="included">Included</option>
                <option value="discounted">Discounted</option>
                <option value="full_price">Full Price</option>
              </select>
            </div>
            {configPolicy === 'discounted' && (
              <div>
                <label className="text-sm font-medium">Discount %</label>
                <Input
                  type="number"
                  value={configDiscount}
                  onChange={(e) => setConfigDiscount(e.target.value)}
                  min="1"
                  max="100"
                  className="mt-1"
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowConfigModal(false)}>Cancel</Button>
              <Button onClick={() => {
                showToast('Network settings updated.')
                setShowConfigModal(false)
              }}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Partner Studios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{demoNetworkStats.totalStudios}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{demoNetworkStats.totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cross-Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{demoNetworkStats.crossBookingsThisMonth} <span className="text-base font-normal text-muted-foreground">this month</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Network Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${demoNetworkStats.networkRevenue}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Partner Studios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium text-muted-foreground">Studio</th>
                  <th className="pb-3 font-medium text-muted-foreground">Discipline</th>
                  <th className="pb-3 font-medium text-muted-foreground">Members</th>
                  <th className="pb-3 font-medium text-muted-foreground">Cross-Booking Policy</th>
                  <th className="pb-3 font-medium text-muted-foreground">Discount</th>
                </tr>
              </thead>
              <tbody>
                {demoNetworkMembers.map((studio) => (
                  <tr key={studio.studioId} className="border-b last:border-0">
                    <td className="py-3 font-medium">{studio.studioName}</td>
                    <td className="py-3 text-muted-foreground">{studio.discipline}</td>
                    <td className="py-3">{studio.memberCount}</td>
                    <td className="py-3">{getPolicyBadge(studio.crossBookingPolicy)}</td>
                    <td className="py-3">
                      {studio.discountPercent > 0 ? `${studio.discountPercent}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Cross-Booking Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Members of any partner studio can book classes at other studios in the network.
              The booking policy determines how pricing works:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="font-medium text-green-800 mb-1">Included</p>
                <p className="text-green-700 text-xs">Classes are included in your home membership at no extra cost.</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="font-medium text-amber-800 mb-1">Discounted</p>
                <p className="text-amber-700 text-xs">Network members get a percentage discount on drop-in rates.</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="font-medium text-gray-800 mb-1">Full Price</p>
                <p className="text-gray-700 text-xs">Book at the standard drop-in rate. No network discount applies.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
