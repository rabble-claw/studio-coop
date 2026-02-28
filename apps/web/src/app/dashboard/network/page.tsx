'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { networkApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Network {
  id: string
  name: string
  description: string | null
  status: string
  created_by_studio_id: string | null
}

interface PartnerStudio {
  id: string
  name: string
  slug: string
  discipline: string
}

export default function NetworkPage() {
  const [studioId, setStudioId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [networks, setNetworks] = useState<Network[]>([])
  const [partners, setPartners] = useState<PartnerStudio[]>([])

  // Create network form
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Invite modal
  const [inviteNetworkId, setInviteNetworkId] = useState<string | null>(null)
  const [inviteStudioId, setInviteStudioId] = useState('')
  const [inviting, setInviting] = useState(false)

  const [message, setMessage] = useState('')

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
        const [networksRes, partnersRes] = await Promise.all([
          networkApi.list(membership.studio_id),
          networkApi.partnerStudios(membership.studio_id),
        ])
        setNetworks(networksRes.networks)
        setPartners(partnersRes.studios)
      } catch {
        // API not available
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreateNetwork() {
    if (!studioId || !newName.trim()) return
    setCreating(true)
    try {
      await networkApi.create(studioId, { name: newName.trim(), description: newDesc.trim() || undefined })
      const res = await networkApi.list(studioId)
      setNetworks(res.networks)
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      setMessage('Network created!')
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : 'Failed'}`)
    }
    setCreating(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleInvite() {
    if (!inviteNetworkId || !inviteStudioId.trim()) return
    setInviting(true)
    try {
      await networkApi.invite(inviteNetworkId, inviteStudioId.trim())
      setInviteNetworkId(null)
      setInviteStudioId('')
      setMessage('Invitation sent!')
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : 'Failed'}`)
    }
    setInviting(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleAccept(networkId: string) {
    if (!studioId) return
    try {
      await networkApi.accept(networkId, studioId)
      const res = await networkApi.list(studioId)
      setNetworks(res.networks)
      setMessage('Invitation accepted!')
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : 'Failed'}`)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  async function handleDecline(networkId: string) {
    if (!studioId) return
    try {
      await networkApi.decline(networkId, studioId)
      const res = await networkApi.list(studioId)
      setNetworks(res.networks)
      setMessage('Invitation declined.')
    } catch (e) {
      setMessage(`Error: ${e instanceof Error ? e.message : 'Failed'}`)
    }
    setTimeout(() => setMessage(''), 3000)
  }

  if (loading) return <div className="py-20 text-center text-muted-foreground">Loading network...</div>

  const activeNetworks = networks.filter(n => n.status === 'active')
  const pendingInvitations = networks.filter(n => n.status === 'pending')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Studio Network</h1>
          <p className="text-muted-foreground">Manage multi-studio networks and partnerships</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Network</Button>
      </div>

      {message && (
        <div className={`text-sm px-4 py-2 rounded-md ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Create Network Form */}
      {showCreate && (
        <Card>
          <CardHeader><CardTitle>Create a New Network</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Network Name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Wellington Studios" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateNetwork} disabled={creating || !newName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Pending Invitations</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvitations.map(net => (
                <div key={net.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{net.name}</p>
                    {net.description && <p className="text-sm text-muted-foreground">{net.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleAccept(net.id)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleDecline(net.id)}>Decline</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Networks */}
      <Card>
        <CardHeader><CardTitle>Your Networks ({activeNetworks.length})</CardTitle></CardHeader>
        <CardContent>
          {activeNetworks.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No networks yet. Create one or wait for an invitation.
            </p>
          ) : (
            <div className="space-y-3">
              {activeNetworks.map(net => (
                <div key={net.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{net.name}</p>
                    {net.description && <p className="text-sm text-muted-foreground">{net.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    {net.created_by_studio_id === studioId && (
                      <Button size="sm" variant="outline" onClick={() => setInviteNetworkId(net.id)}>
                        Invite Studio
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      {inviteNetworkId && (
        <Card>
          <CardHeader><CardTitle>Invite Studio to Network</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Studio ID</label>
              <Input value={inviteStudioId} onChange={e => setInviteStudioId(e.target.value)} placeholder="Enter studio ID to invite" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting || !inviteStudioId.trim()}>
                {inviting ? 'Sending...' : 'Send Invitation'}
              </Button>
              <Button variant="outline" onClick={() => { setInviteNetworkId(null); setInviteStudioId('') }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partner Studios */}
      <Card>
        <CardHeader><CardTitle>Partner Studios ({partners.length})</CardTitle></CardHeader>
        <CardContent>
          {partners.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No partner studios yet. Invite studios to your network to see them here.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {partners.map(studio => (
                <div key={studio.id} className="p-4 border rounded-lg">
                  <p className="font-medium">{studio.name}</p>
                  <p className="text-sm text-muted-foreground">{studio.slug}.studio.coop</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">{studio.discipline}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
