import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '@/lib/supabase'

interface Discount {
  type: 'percent_off' | 'amount_off' | 'free_classes'
  value: number
  description: string
  appliesTo: string
  couponId: string
}

interface CouponInputProps {
  studioId: string
  /** Called when a valid coupon is applied */
  onApplied?: (discount: Discount) => void
  /** Called when the coupon is cleared */
  onCleared?: () => void
  /** API base URL (defaults to env var or localhost) */
  apiBase?: string
}

/**
 * "Have a coupon code?" expandable field for mobile checkout flows.
 * Validates in real-time via the coupon validate endpoint and
 * shows a discount preview before payment.
 */
export function CouponInput({ studioId, onApplied, onCleared, apiBase }: CouponInputProps) {
  const base = apiBase ?? (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001')

  const [open, setOpen]         = useState(false)
  const [code, setCode]         = useState('')
  const [loading, setLoading]   = useState(false)
  const [discount, setDiscount] = useState<Discount | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function validate() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setDiscount(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Sign in to apply a coupon code.')
        return
      }

      const res = await fetch(`${base}/api/studios/${studioId}/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ code: trimmed }),
      })

      const data = await res.json() as { valid: boolean; discount?: Discount; reason?: string }

      if (!data.valid) {
        setError(data.reason ?? 'Invalid coupon code.')
        return
      }

      setDiscount(data.discount!)
      onApplied?.(data.discount!)
    } catch {
      setError('Could not validate coupon. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setCode('')
    setDiscount(null)
    setError(null)
    onCleared?.()
  }

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text className="text-primary text-sm underline">Have a coupon code?</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View className="space-y-2">
      <Text className="text-sm font-medium text-foreground">Coupon code</Text>

      {discount ? (
        /* Applied state */
        <View className="flex-row items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <Text className="flex-1 text-green-700 text-sm font-medium">
            {code.toUpperCase()} — {discount.description}
          </Text>
          <TouchableOpacity onPress={clear} activeOpacity={0.7}>
            <Text className="text-green-700 text-xs underline">Remove</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Input state */
        <View className="space-y-2">
          <View className="flex-row gap-2">
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                setError(null)
              }}
              placeholder="ENTER CODE"
              placeholderTextColor="#9e8da8"
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={validate}
              editable={!loading}
              className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-foreground font-mono tracking-widest text-sm"
            />
            <TouchableOpacity
              onPress={validate}
              disabled={loading || !code.trim()}
              activeOpacity={0.7}
              className="bg-primary rounded-xl px-4 py-3 items-center justify-center"
              style={{ opacity: loading || !code.trim() ? 0.5 : 1 }}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-white font-medium text-sm">Apply</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => { setOpen(false); clear() }}
            activeOpacity={0.7}
          >
            <Text className="text-muted text-xs">Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <Text className="text-red-500 text-xs">{error}</Text>
      )}
    </View>
  )
}
