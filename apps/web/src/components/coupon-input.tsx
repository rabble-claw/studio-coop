'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

/**
 * "Have a coupon code?" expandable field for checkout flows.
 * Validates in real-time via the coupon validate endpoint and
 * shows a discount preview before payment.
 */
export function CouponInput({ studioId, onApplied, onCleared }: CouponInputProps) {
  const supabase = useRef(createClient()).current

  const [open, setOpen]           = useState(false)
  const [code, setCode]           = useState('')
  const [loading, setLoading]     = useState(false)
  const [discount, setDiscount]   = useState<Discount | null>(null)
  const [error, setError]         = useState<string | null>(null)

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

      const res = await fetch(`/api/studios/${studioId}/coupons/validate`, {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      validate()
    }
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm underline underline-offset-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          Have a coupon code?
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Coupon code</p>

          {discount ? (
            /* Applied state */
            <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2.5">
              <span className="text-green-700 text-sm font-medium flex-1">
                {code.toUpperCase()} — {discount.description}
              </span>
              <button
                type="button"
                onClick={clear}
                className="text-xs text-green-700 underline hover:text-green-900"
              >
                Remove
              </button>
            </div>
          ) : (
            /* Input state */
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                  setError(null)
                }}
                onKeyDown={handleKeyDown}
                placeholder="ENTER CODE"
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono uppercase tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                onClick={validate}
                disabled={loading || !code.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '...' : 'Apply'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); clear() }}
                className="rounded-md border border-input px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
