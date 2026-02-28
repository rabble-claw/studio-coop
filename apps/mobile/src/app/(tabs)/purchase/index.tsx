import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { paymentApi } from '@/lib/api'

interface Plan {
  id: string
  name: string
  description: string | null
  type: string
  price_cents: number
  currency: string
  interval: string
  class_limit: number | null
  validity_days: number | null
  stripe_price_id: string | null
  active: boolean
  sort_order: number
}

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function planLabel(plan: Plan): string {
  if (plan.type === 'class_pack') {
    return plan.class_limit ? `${plan.class_limit} Classes` : 'Class Pack'
  }
  if (plan.type === 'drop_in') return 'Drop-in'
  if (plan.interval === 'month') return '/month'
  if (plan.interval === 'year') return '/year'
  return ''
}

export default function PurchaseIndexScreen() {
  const { studioId } = useAuth()
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  const loadPlans = useCallback(async () => {
    if (!studioId) return
    setLoading(true)
    try {
      const data = await paymentApi.listPlans(studioId)
      setPlans(data.plans ?? [])
    } catch (e) {
      console.error('Failed to load plans:', e)
    } finally {
      setLoading(false)
    }
  }, [studioId])

  useEffect(() => { loadPlans() }, [loadPlans])

  const subscriptionPlans = plans.filter(p => p.type === 'unlimited' || p.type === 'limited' || (p.interval !== 'once' && p.type !== 'class_pack' && p.type !== 'drop_in'))
  const classPacks = plans.filter(p => p.type === 'class_pack')

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPlans} />}
      >
        <Text className="text-2xl font-bold text-foreground mb-1">Membership</Text>
        <Text className="text-muted mb-6">Choose a plan that works for you</Text>

        {loading && plans.length === 0 && (
          <ActivityIndicator size="large" className="mt-10" />
        )}

        {/* Subscription plans */}
        {subscriptionPlans.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">Subscription Plans</Text>
            {subscriptionPlans.map(plan => (
              <TouchableOpacity
                key={plan.id}
                className="bg-card rounded-2xl border border-border p-4 mb-3"
                onPress={() => router.push({
                  pathname: '/(tabs)/purchase/subscribe',
                  params: { planId: plan.id, planName: plan.name, priceCents: plan.price_cents.toString(), currency: plan.currency, interval: plan.interval },
                })}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">{plan.name}</Text>
                    {plan.description && (
                      <Text className="text-muted text-sm mt-1">{plan.description}</Text>
                    )}
                  </View>
                  <View className="items-end ml-3">
                    <Text className="text-foreground font-bold text-lg">
                      {formatPrice(plan.price_cents, plan.currency)}
                    </Text>
                    <Text className="text-muted text-xs">{planLabel(plan)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Class packs */}
        {classPacks.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-foreground mb-3">Class Packs</Text>
            {classPacks.map(plan => (
              <TouchableOpacity
                key={plan.id}
                className="bg-card rounded-2xl border border-border p-4 mb-3"
                onPress={() => router.push({
                  pathname: '/(tabs)/purchase/class-pack',
                  params: { planId: plan.id, planName: plan.name, priceCents: plan.price_cents.toString(), currency: plan.currency, classLimit: (plan.class_limit ?? 0).toString() },
                })}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-foreground font-semibold text-base">{plan.name}</Text>
                    {plan.description && (
                      <Text className="text-muted text-sm mt-1">{plan.description}</Text>
                    )}
                    {plan.class_limit && (
                      <Text className="text-muted text-xs mt-1">{plan.class_limit} classes included</Text>
                    )}
                    {plan.validity_days && (
                      <Text className="text-muted text-xs">Valid for {plan.validity_days} days</Text>
                    )}
                  </View>
                  <View className="items-end ml-3">
                    <Text className="text-foreground font-bold text-lg">
                      {formatPrice(plan.price_cents, plan.currency)}
                    </Text>
                    <Text className="text-muted text-xs">{planLabel(plan)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!loading && plans.length === 0 && (
          <View className="items-center py-16">
            <Text className="text-muted text-center">No plans available at this studio right now.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
