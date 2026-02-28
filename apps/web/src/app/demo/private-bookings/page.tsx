'use client'

import { useState } from 'react'
import { demoPrivateBookings, type DemoPrivateBooking } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatTime, formatDate } from '@/lib/utils'

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}

const typeLabels: Record<string, string> = {
  'Private Lesson': 'bg-purple-100 text-purple-700',
  'Pole Party': 'bg-pink-100 text-pink-700',
  'Corporate Event': 'bg-indigo-100 text-indigo-700',
}

export default function DemoPrivateBookingsPage() {
  const [bookings, setBookings] = useState<DemoPrivateBooking[]>([...demoPrivateBookings])
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [bookingType, setBookingType] = useState('Private Lesson')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')

  function resetForm() {
    setClientName('')
    setClientEmail('')
    setBookingType('Private Lesson')
    setDate('')
    setStartTime('')
    setEndTime('')
    setPrice('')
    setNotes('')
    setShowForm(false)
  }

  function handleCreate() {
    if (!clientName.trim() || !clientEmail.trim() || !date || !startTime || !endTime || !price) return

    const newBooking: DemoPrivateBooking = {
      id: `pb-${Date.now()}`,
      studio_id: 'demo-empire-001',
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      type: bookingType,
      date,
      start_time: startTime + ':00',
      end_time: endTime + ':00',
      status: 'pending',
      notes: notes.trim(),
      price_cents: Math.round(Number(price) * 100),
      currency: 'NZD',
    }

    setBookings((prev) => [newBooking, ...prev])
    resetForm()
  }

  function updateStatus(bookingId: string, newStatus: DemoPrivateBooking['status']) {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: newStatus } : b
      )
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Private Bookings</h1>
          <p className="text-muted-foreground">Manage private lessons and events</p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Create Booking</Button>
      </div>

      {/* Create Booking Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => resetForm()}>
          <div className="bg-card rounded-lg shadow-lg border w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Create Booking</h2>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Client name</label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Client email</label>
                <Input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Type</label>
                <select
                  value={bookingType}
                  onChange={(e) => setBookingType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="Private Lesson">Private Lesson</option>
                  <option value="Pole Party">Pole Party</option>
                  <option value="Corporate Event">Corporate Event</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Start time</label>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End time</label>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Price (NZD)</label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 85.00"
                  min="0"
                  step="0.01"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements..."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!clientName.trim() || !clientEmail.trim() || !date || !startTime || !endTime || !price}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {bookings.map((booking) => (
          <Card key={booking.id}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{booking.client_name}</div>
                      <div className="text-sm text-muted-foreground">{booking.client_email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full ${typeLabels[booking.type] ?? 'bg-gray-100 text-gray-700'}`}>
                      {booking.type}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(booking.date)} &middot; {formatTime(booking.start_time)} &ndash; {formatTime(booking.end_time)}
                    </span>
                  </div>

                  {booking.notes && (
                    <p className="text-sm text-muted-foreground">{booking.notes}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={`capitalize border-0 ${statusColors[booking.status]}`}>
                    {booking.status}
                  </Badge>
                  <div className="text-sm font-medium">
                    ${(booking.price_cents / 100).toFixed(2)} {booking.currency}
                  </div>
                  <div className="flex gap-2">
                    {booking.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmed')}>Confirm</Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'cancelled')}>Cancel</Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <>
                        <Button size="sm" onClick={() => updateStatus(booking.id, 'completed')}>Complete</Button>
                        <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'cancelled')}>Cancel</Button>
                      </>
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
