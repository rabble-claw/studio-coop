import '../../global.css'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { NativeModules } from 'react-native'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { setupNotificationListeners } from '@/lib/push'

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

// @stripe/stripe-react-native requires a development build (not Expo Go).
// Conditionally import to avoid crashing in Expo Go.
const hasStripeNative = !!NativeModules.StripeSdk
let StripeProvider: React.ComponentType<{ publishableKey: string; merchantIdentifier: string; children: React.ReactNode }> | null = null
if (hasStripeNative) {
  try {
    StripeProvider = require('@stripe/stripe-react-native').StripeProvider
  } catch {
    // Stripe native module not available
  }
}

function AuthGate() {
  const { session, loading, studioId, studioLoaded } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === 'auth'
    const inOnboarding = segments[0] === 'onboarding'

    if (!session && !inAuthGroup) {
      router.replace('/auth/sign-in')
    } else if (session && inAuthGroup) {
      // Logged in — check if they have a studio
      if (studioLoaded && !studioId) {
        router.replace('/onboarding')
      } else {
        router.replace('/(tabs)')
      }
    } else if (session && studioLoaded && !studioId && !inOnboarding) {
      // Logged in, no studio, not already on onboarding
      router.replace('/onboarding')
    } else if (session && studioId && inOnboarding) {
      // Has studio now, leave onboarding
      router.replace('/(tabs)')
    }
  }, [session, loading, studioId, studioLoaded, segments])

  // Set up push notification deep link listeners when user is authenticated
  useEffect(() => {
    if (!session) return
    const cleanup = setupNotificationListeners()
    return cleanup
  }, [session])

  return <Slot />
}

export default function RootLayout() {
  const content = (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )

  if (StripeProvider) {
    return (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.coop.studio.app"
      >
        {content}
      </StripeProvider>
    )
  }

  return content
}
