import { useState, useCallback } from 'react'
import { Alert } from 'react-native'
import { useStripe } from '@stripe/stripe-react-native'

interface UsePaymentSheetOptions {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export function usePaymentSheet(options?: UsePaymentSheetOptions) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const [loading, setLoading] = useState(false)

  const openPaymentSheet = useCallback(
    async (clientSecret: string, label?: string) => {
      setLoading(true)
      try {
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
          // User cancelled is code "Canceled"
          if (presentError.code === 'Canceled') {
            return false
          }
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
    [initPaymentSheet, presentPaymentSheet, options],
  )

  return { openPaymentSheet, loading }
}
