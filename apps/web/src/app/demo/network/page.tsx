'use client'

import { demoNetworks, demoNetworkMembers, demoNetworkStats } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{network.name}</h1>
        <p className="text-muted-foreground">{network.description}</p>
      </div>

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
