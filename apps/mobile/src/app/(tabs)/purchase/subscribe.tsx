import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator, Linking } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/lib/auth-context'
import { paymentApi } from '@/lib/api'

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function intervalLabel(interval: string): string {
  if (interval === 'month') return 'monthly'
  if (interval === 'year') return 'annually'
  return interval
}

export default function SubscribeScreen() {
  const { planId, planName, priceCents, currency, interval } = useLocalSearchParams<{
    planId: string
    planName: string
    priceCents: string
    currency: string
    interval: string
  }>()
  const { studioId } = useAuth()
  const router = useRouter()
  const [couponCode, setCouponCode] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  // Handle Stripe checkout completion deep link
  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const url = event.url
      if (url?.includes('status=success') || url?.includes('session_id=')) {
        Alert.alert('Payment Successful', 'Your subscription has been activated.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      } else if (url?.includes('status=cancelled')) {
        Alert.alert('Payment Cancelled', 'Your subscription was not completed.')
      }
    }

    const subscription = Linking.addEventListener('url', handleDeepLink)

    // Check if the app was opened via a deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url })
    })

    return () => subscription.remove()
  }, [router])

  async function handleSubscribe() {
    if (!studioId || !planId) return
    setSubscribing(true)
    try {
      const body: { couponCode?: string; successUrl?: string; cancelUrl?: string } = {}
      if (couponCode.trim()) {
        body.couponCode = couponCode.trim()
      }
      // For mobile, we use deep link URLs so Stripe redirects back to the app
      body.successUrl = 'studio-coop://payment-complete?status=success'
      body.cancelUrl = 'studio-coop://payment-complete?status=cancelled'

      const result = await paymentApi.subscribe(studioId, planId, body)

      if (result.checkoutUrl) {
        // Open Stripe Checkout in browser — user completes payment there
        await Linking.openURL(result.checkoutUrl)
        // Navigate back after opening the URL
        Alert.alert(
          'Complete Payment',
          'Complete your payment in the browser. Your subscription will be active once payment is confirmed.',
          [{ text: 'OK', onPress: () => router.back() }],
        )
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not start subscription')
    } finally {
      setSubscribing(false)
    }
  }

  const price = parseInt(priceCents ?? '0', 10)

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <View className="flex-1 px-4 pt-4">
        {/* Back button */}
        <TouchableOpacity onPress={() => router.back()} className="mb-4">
          <Text className="text-primary text-base">&larr; Back</Text>
        </TouchableOpacity>

        {/* Plan details card */}
        <View className="bg-card rounded-2xl border border-border p-6 mb-6">
          <Text className="text-2xl font-bold text-foreground mb-2">{planName}</Text>

          <View className="flex-row items-baseline mt-2">
            <Text className="text-4xl font-bold text-foreground">
              {formatPrice(price, currency ?? 'usd')}
            </Text>
            <Text className="text-muted text-lg ml-1">
              /{interval === 'year' ? 'yr' : 'mo'}
            </Text>
          </View>

          <Text className="text-muted text-sm mt-2">
            Billed {intervalLabel(interval ?? 'month')}. Cancel anytime.
          </Text>
        </View>

        {/* Benefits */}
        <View className="mb-6">
          <Text className="text-foreground font-semibold mb-2">Membership includes</Text>
          <View className="gap-2">
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">Unlimited class bookings</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">Priority waitlist access</Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-green-600 mr-2 text-base">&#10003;</Text>
              <Text className="text-foreground text-sm">Cancel or pause anytime</Text>
            </View>
          </View>
        </View>

        {/* Coupon code */}
        <View className="mb-6">
          <Text className="text-foreground font-medium text-sm mb-1">Have a coupon code?</Text>
          <TextInput
            className="bg-card border border-border rounded-xl px-4 py-3 text-foreground"
            style={{ color: '#1a1a1a' }}
            placeholder="Enter code"
            placeholderTextColor="#9ca3af"
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
          />
        </View>

        {/* Subscribe button */}
        <View className="mt-auto pb-6">
          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${subscribing ? 'bg-primary/50' : 'bg-primary'}`}
            onPress={handleSubscribe}
            disabled={subscribing}
          >
            {subscribing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-lg">
                Subscribe for {formatPrice(price, currency ?? 'usd')}/{interval === 'year' ? 'yr' : 'mo'}
              </Text>
            )}
          </TouchableOpacity>
          <Text className="text-muted text-xs text-center mt-2">
            You will be redirected to Stripe to complete payment
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
