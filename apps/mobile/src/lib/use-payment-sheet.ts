import { useState, useCallback } from 'react'
import { Alert, NativeModules, Linking } from 'react-native'

interface UsePaymentSheetOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

const hasStripe = !!NativeModules.StripeSdk

export function usePaymentSheet(options?: UsePaymentSheetOptions) {
  const [loading, setLoading] = useState(false)

  const openPaymentSheet = useCallback(
    async (clientSecret: string, label?: string) => {
      if (!hasStripe) {
        Alert.alert(
          'Stripe Not Available',
          'In-app payments require a development build. Use the web dashboard to purchase.',
        )
        return false
      }

      setLoading(true)
      try {
        // Dynamic require — only runs when native module is present
        const { initPaymentSheet, presentPaymentSheet } = require('@stripe/stripe-react-native')

        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: label ?? 'Studio Co-op',
          applePay: { merchantCountryCode: 'US' },
          googlePay: { merchantCountryCode: 'US', testEnv: __DEV__ },
          returnURL: 'studio-coop://payment-complete',
        })

        if (initError) {
          const msg = initError.message ?? 'Could not initialize payment'
          Alert.alert('Payment Error', msg)
          options?.onError?.(msg)
          return false
        }

        const { error: presentError } = await presentPaymentSheet()

        if (presentError) {
          if (presentError.code === 'Canceled') return false
          const msg = presentError.message ?? 'Payment failed'
          Alert.alert('Payment Failed', msg)
          options?.onError?.(msg)
          return false
        }

        options?.onSuccess?.()
        return true
      } catch (e: any) {
        const msg = e?.message ?? 'An unexpected error occurred'
        Alert.alert('Error', msg)
        options?.onError?.(msg)
        return false
      } finally {
        setLoading(false)
      }
    },
    [options],
  )

  return { openPaymentSheet, loading, isAvailable: hasStripe }
}
