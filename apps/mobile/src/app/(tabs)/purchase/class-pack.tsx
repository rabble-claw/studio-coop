import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { paymentApi } from '@/lib/api'
import { usePaymentSheet } from '@/lib/use-payment-sheet'

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export default function ClassPackPurchaseScreen() {
  const { planId, planName, priceCents, currency, classLimit } = useLocalSearchParams<{
    planId: string
    planName: string
    priceCents: string
    currency: string
    classLimit: string
  }>()
  const { studioId } = useAuth()
  const router = useRouter()
  const [purchasing, setPurchasing] = useState(false)

  const { openPaymentSheet, loading: sheetLoading } = usePaymentSheet({
    onSuccess: () => {
      Alert.alert(
        'Purchase Complete',
        `Your ${planName} class pack is now active.`,
        [{ text: 'OK', onPress: () => router.back() }],
      )
    },
  })

  async function handlePurchase() {
    if (!studioId || !planId) return
    setPurchasing(true)
    try {
      const { clientSecret } = await paymentApi.purchaseClassPack(studioId, planId)
      await openPaymentSheet(clientSecret, 'Studio Co-op')
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start payment')
    } finally {
      setPurchasing(false)
    }
  }

  const price = parseInt(priceCents ?? '0', 10)
  const classes = parseInt(classLimit ?? '0', 10)
  const isLoading = purchasing || sheetLoading

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 px-4 pt-4">
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-primary text-base">&larr; Back</Text>
        </TouchableOpacity>

        {/* Pack details card */}
        <View className="bg-card rounded-2xl border border-border p-6 mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">{planName}</Text>

          <View className="flex-row items-baseline mt-2">
            <Text className="text-4xl font-bold text-foreground">
              {formatPrice(price, currency ?? 'usd')}
            </Text>
          </View>

          {classes > 0 && (
            <View className="mt-4 bg-primary/10 rounded-xl p-3">
              <Text className="text-primary font-semibold text-center">
                {classes} Classes Included
              </Text>
              {price > 0 && classes > 0 && (
                <Text className="text-muted text-xs text-center mt-1">
                  {formatPrice(Math.round(price / classes), currency ?? 'usd')} per class
                </Text>
              )}
            </View>
          )}
        </View>

        {/* What's included */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">What you get</Text>
          <View className="gap-2">
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">{classes} classes to use at your pace</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">Book any class on the schedule</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">Apple Pay and Google Pay accepted</Text>
            </View>
          </View>
        </View>

        {/* Purchase button */}
        <View className="mt-auto pb-6">
          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${isLoading ? 'bg-primary/50' : 'bg-primary'}`}
            onPress={handlePurchase}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">
                Pay {formatPrice(price, currency ?? 'usd')}
              </Text>
            )}
          </TouchableOpacity>
          <Text className="text-muted text-xs text-center mt-2">
            Secure payment via Stripe
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
