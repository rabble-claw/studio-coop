import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter, Stack } from 'expo-router'
import { discoverApi } from '@/lib/api'

type ClassItem = {
  id: string
  date: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number | null
  teacher: { name: string } | null
  template: { name: string; description: string | null } | null
}

type Plan = {
  id: string
  name: string
  description: string | null
  type: string
  price_cents: number
  currency: string
  interval: string
  class_limit: number | null
  validity_days: number | null
}

type StudioProfile = {
  studio: {
    id: string
    name: string
    slug: string
    discipline: string
    description: string | null
    logo_url: string | null
    address: string | null
    phone: string | null
    website: string | null
    email: string | null
    instagram: string | null
    facebook: string | null
    city: string | null
  }
  classes: ClassItem[]
  plans: Plan[]
  member_count: number
}

function formatTime(time: string): string {
  const [h, m] = time.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
  return `${h12}:${m} ${ampm}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatPrice(priceCents: number, currency: string): string {
  const amount = (priceCents / 100).toFixed(2).replace(/\.00$/, '')
  const symbol = currency.toUpperCase() === 'NZD' ? 'NZ$' : currency.toUpperCase() === 'AUD' ? 'A$' : '$'
  return `${symbol}${amount}`
}

export default function PublicStudioProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [data, setData] = useState<StudioProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    discoverApi
      .studioBySlug(slug)
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load studio'))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-muted text-base text-center">{error || 'Studio not found'}</Text>
      </View>
    )
  }

  const { studio, classes, plans, member_count } = data

  // Group classes by date
  const classesByDate: Record<string, ClassItem[]> = {}
  for (const cls of classes) {
    if (!classesByDate[cls.date]) classesByDate[cls.date] = []
    classesByDate[cls.date].push(cls)
  }

  return (
    <>
      <Stack.Screen options={{ title: studio.name }} />
      <View className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Header */}
          <View className="items-center pt-6 pb-4 px-6">
            {studio.logo_url ? (
              <Image
                source={{ uri: studio.logo_url }}
                className="w-20 h-20 rounded-2xl mb-3"
                resizeMode="cover"
              />
            ) : (
              <View className="w-20 h-20 rounded-2xl mb-3 bg-primary/10 items-center justify-center">
                <Text className="text-primary font-bold text-3xl">
                  {studio.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text className="text-foreground font-bold text-2xl text-center">{studio.name}</Text>
            <Text className="text-muted text-sm capitalize mt-1">{studio.discipline}</Text>
            <Text className="text-muted text-xs mt-1">
              {member_count} member{member_count !== 1 ? 's' : ''}
            </Text>
            {studio.description && (
              <Text className="text-muted text-sm text-center mt-3 leading-5 px-4">
                {studio.description}
              </Text>
            )}
            {studio.address && (
              <Text className="text-muted text-xs mt-2">{studio.address}</Text>
            )}

            {/* Social links */}
            <View className="flex-row items-center gap-4 mt-3">
              {studio.instagram && (
                <TouchableOpacity onPress={() => Linking.openURL(studio.instagram!)}>
                  <Text className="text-primary text-sm">Instagram</Text>
                </TouchableOpacity>
              )}
              {studio.facebook && (
                <TouchableOpacity onPress={() => Linking.openURL(studio.facebook!)}>
                  <Text className="text-primary text-sm">Facebook</Text>
                </TouchableOpacity>
              )}
              {studio.website && (
                <TouchableOpacity onPress={() => Linking.openURL(studio.website!)}>
                  <Text className="text-primary text-sm">Website</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Schedule */}
          <View className="px-4 mt-4">
            <Text className="text-foreground font-bold text-lg mb-3">Upcoming Classes</Text>
            {Object.keys(classesByDate).length === 0 ? (
              <Text className="text-muted text-sm py-6 text-center">No upcoming classes scheduled.</Text>
            ) : (
              Object.entries(classesByDate).map(([date, dayClasses]) => (
                <View key={date} className="mb-4">
                  <Text className="text-muted text-xs font-semibold uppercase tracking-wider mb-2">
                    {formatDate(date)}
                  </Text>
                  {dayClasses.map((cls) => {
                    const spotsLeft = cls.max_capacity - (cls.booked_count ?? 0)
                    return (
                      <View
                        key={cls.id}
                        className="bg-card border border-border rounded-xl p-3 mb-2 flex-row items-center justify-between"
                      >
                        <View className="flex-1">
                          <Text className="text-foreground font-medium">
                            {cls.template?.name ?? 'Class'}
                          </Text>
                          <Text className="text-muted text-xs mt-0.5">
                            {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                            {cls.teacher && ` · ${cls.teacher.name}`}
                          </Text>
                        </View>
                        <Text
                          className={`text-xs font-medium ${
                            spotsLeft <= 2 ? 'text-red-500' : 'text-muted'
                          }`}
                        >
                          {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              ))
            )}
          </View>

          {/* Pricing */}
          {plans.length > 0 && (
            <View className="px-4 mt-4">
              <Text className="text-foreground font-bold text-lg mb-3">Membership & Pricing</Text>
              {plans.map((plan) => (
                <View
                  key={plan.id}
                  className={`border rounded-xl p-4 mb-3 ${
                    plan.type === 'unlimited'
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card'
                  }`}
                >
                  {plan.type === 'unlimited' && (
                    <View className="bg-primary rounded-full self-start px-2 py-0.5 mb-2">
                      <Text className="text-white text-xs font-semibold">Most popular</Text>
                    </View>
                  )}
                  <Text className="text-foreground font-semibold text-base">{plan.name}</Text>
                  {plan.description && (
                    <Text className="text-muted text-sm mt-1">{plan.description}</Text>
                  )}
                  <View className="flex-row items-baseline mt-2">
                    <Text className="text-foreground font-bold text-2xl">
                      {formatPrice(plan.price_cents, plan.currency)}
                    </Text>
                    {plan.interval === 'month' && (
                      <Text className="text-muted text-sm ml-1">/ month</Text>
                    )}
                    {plan.interval === 'year' && (
                      <Text className="text-muted text-sm ml-1">/ year</Text>
                    )}
                  </View>
                  {plan.class_limit && plan.type === 'class_pack' && (
                    <Text className="text-muted text-xs mt-1">
                      {plan.class_limit} classes
                      {plan.validity_days ? ` · valid ${plan.validity_days} days` : ''}
                    </Text>
                  )}
                  {plan.type === 'limited' && plan.class_limit && (
                    <Text className="text-muted text-xs mt-1">
                      Up to {plan.class_limit} classes / month
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Sticky bottom CTA */}
        <View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 pb-8 pt-3">
          <TouchableOpacity
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
            onPress={() => router.push(`/auth/sign-up?studio=${studio.slug}`)}
          >
            <Text className="text-white font-semibold text-base">
              Join {studio.name}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  )
}
