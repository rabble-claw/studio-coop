import '../../global.css'
import { Slot, useRouter, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { setupNotificationListeners } from '@/lib/push'

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
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
