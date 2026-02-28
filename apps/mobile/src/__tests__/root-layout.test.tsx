import React from 'react'
import { render } from '@testing-library/react-native'
import { NativeModules } from 'react-native'

// Mock auth context
jest.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({
    session: null,
    user: null,
    loading: true,
    studioId: null,
    studioLoaded: false,
  }),
}))

jest.mock('@/lib/push', () => ({
  setupNotificationListeners: jest.fn(() => jest.fn()),
}))

import RootLayoutRaw from '../app/_layout'

// Cast to work around @types/react v18 vs v19 structural incompatibility in pnpm monorepo
const RootLayout = RootLayoutRaw as React.FC

describe('RootLayout', () => {
  it('renders without crashing when Stripe native module is NOT available (Expo Go)', () => {
    // Ensure StripeSdk is not in NativeModules (simulates Expo Go)
    delete (NativeModules as any).StripeSdk

    // Slot is mocked to return null, so toJSON() is null — just verify no throw
    expect(() => render(<RootLayout />)).not.toThrow()
  })

  it('renders without crashing when Stripe native module IS available', () => {
    // Simulate native module being present
    ;(NativeModules as any).StripeSdk = {}

    // Mock the stripe module
    jest.mock('@stripe/stripe-react-native', () => ({
      StripeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }), { virtual: true })

    expect(() => render(<RootLayout />)).not.toThrow()

    // Clean up
    delete (NativeModules as any).StripeSdk
  })
})

describe('React instance', () => {
  it('uses a single React instance (hooks work)', () => {
    // This test verifies that React hooks work, which would fail
    // if there were duplicate React instances (the root cause of
    // "Cannot read property useMemo of null")
    const TestComponent = () => {
      const [value, setValue] = React.useState('works')
      const memoized = React.useMemo(() => value.toUpperCase(), [value])
      return <>{memoized}</>
    }

    // Should not throw "Cannot read property 'useMemo' of null"
    expect(() => render(<TestComponent />)).not.toThrow()
  })
})
