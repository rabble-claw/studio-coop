'use client'

import { demoPrivateBookings } from '@/lib/demo-data'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Private Bookings</h1>
          <p className="text-muted-foreground">Manage private lessons and events</p>
        </div>
        <Button disabled>+ Create Booking</Button>
      </div>

      <div className="grid gap-3">
        {demoPrivateBookings.map((booking) => (
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
                        <Button size="sm" disabled>Confirm</Button>
                        <Button size="sm" variant="outline" disabled>Cancel</Button>
                      </>
                    )}
                    {booking.status === 'confirmed' && (
                      <>
                        <Button size="sm" disabled>Complete</Button>
                        <Button size="sm" variant="outline" disabled>Cancel</Button>
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
