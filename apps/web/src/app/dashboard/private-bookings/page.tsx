'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface PrivateBooking {
  id: string
  client_name: string
  client_email: string
  type: string
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  price_cents: number
  deposit_paid: boolean
  notes: string
}

export default function PrivateBookingsPage() {
  const [bookings, setBookings] = useState<PrivateBooking[]>([
    {
      id: '1', client_name: 'Alex Rivera', client_email: 'alex@example.com',
      type: 'Private Aerial Silks', date: '2026-03-05', start_time: '14:00', end_time: '15:00',
      status: 'confirmed', price_cents: 12000, deposit_paid: true, notes: 'Birthday celebration, 4 people'
    },
    {
      id: '2', client_name: 'Jordan Walsh', client_email: 'jordan@example.com',
      type: 'Pole Party', date: '2026-03-08', start_time: '18:00', end_time: '20:00',
      status: 'pending', price_cents: 35000, deposit_paid: false, notes: 'Hen party, 12 people, needs bubbly setup'
    },
    {
      id: '3', client_name: 'Sam Chen', client_email: 'sam@example.com',
      type: '1-on-1 Trapeze', date: '2026-03-02', start_time: '10:00', end_time: '11:00',
      status: 'completed', price_cents: 9500, deposit_paid: true, notes: ''
    },
  ])

  const [showCreate, setShowCreate] = useState(false)
  const [newBooking, setNewBooking] = useState({
    client_name: '', client_email: '', type: 'Private Lesson',
    date: '', start_time: '', end_time: '', price: '', notes: '',
  })

  function handleCreate() {
    const booking: PrivateBooking = {
      id: Date.now().toString(),
      client_name: newBooking.client_name,
      client_email: newBooking.client_email,
      type: newBooking.type,
      date: newBooking.date,
      start_time: newBooking.start_time,
      end_time: newBooking.end_time,
      status: 'pending',
      price_cents: Math.round(parseFloat(newBooking.price || '0') * 100),
      deposit_paid: false,
      notes: newBooking.notes,
    }
    setBookings([booking, ...bookings])
    setShowCreate(false)
    setNewBooking({ client_name: '', client_email: '', type: 'Private Lesson', date: '', start_time: '', end_time: '', price: '', notes: '' })
  }

  function updateStatus(id: string, status: PrivateBooking['status']) {
    setBookings(bookings.map(b => b.id === id ? { ...b, status } : b))
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Private Bookings</h1>
          <p className="text-muted-foreground">Parties, private lessons, and group bookings</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Booking'}
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle>New Private Booking</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Client Name</label>
                <Input value={newBooking.client_name} onChange={e => setNewBooking({...newBooking, client_name: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={newBooking.client_email} onChange={e => setNewBooking({...newBooking, client_email: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <select className="w-full border rounded-md px-3 py-2 text-sm" value={newBooking.type}
                  onChange={e => setNewBooking({...newBooking, type: e.target.value})}>
                  <option>Private Lesson</option>
                  <option>Pole Party</option>
                  <option>Aerial Party</option>
                  <option>Corporate Event</option>
                  <option>Photoshoot</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={newBooking.date} onChange={e => setNewBooking({...newBooking, date: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Start</label>
                <Input type="time" value={newBooking.start_time} onChange={e => setNewBooking({...newBooking, start_time: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">End</label>
                <Input type="time" value={newBooking.end_time} onChange={e => setNewBooking({...newBooking, end_time: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Price ($NZD)</label>
                <Input type="number" step="0.01" value={newBooking.price} onChange={e => setNewBooking({...newBooking, price: e.target.value})} />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input value={newBooking.notes} onChange={e => setNewBooking({...newBooking, notes: e.target.value})} placeholder="Special requests, group size, etc." />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!newBooking.client_name || !newBooking.date}>Create Booking</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {bookings.map(booking => (
          <Card key={booking.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{booking.client_name}</span>
                    <Badge className={statusColors[booking.status]}>{booking.status}</Badge>
                    {booking.deposit_paid && <Badge variant="outline">Deposit paid</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {booking.type} · {booking.date} · {booking.start_time}–{booking.end_time}
                  </div>
                  <div className="text-sm text-muted-foreground">{booking.client_email}</div>
                  {booking.notes && <div className="text-sm italic mt-1">&ldquo;{booking.notes}&rdquo;</div>}
                </div>
                <div className="text-right space-y-2">
                  <div className="font-bold">${(booking.price_cents / 100).toFixed(2)}</div>
                  <div className="flex gap-2">
                    {booking.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmed')}>Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'cancelled')}>Decline</Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <Button size="sm" onClick={() => updateStatus(booking.id, 'completed')}>Mark Complete</Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
