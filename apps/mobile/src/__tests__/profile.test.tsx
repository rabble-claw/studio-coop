import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

const mockProfileGet = jest.fn().mockResolvedValue({
  name: 'Test User',
  email: 'test@test.com',
  total_classes: 42,
  this_month: 8,
  streak: 3,
  member_since: 'Jan 2026',
})
const mockMemberships = jest.fn().mockResolvedValue([])
const mockAttendance = jest.fn().mockResolvedValue([])
const mockClassPasses = jest.fn().mockResolvedValue([])
const mockComps = jest.fn().mockResolvedValue([])
const mockSubMine = jest.fn().mockResolvedValue(null)
const mockSignOut = jest.fn()

jest.mock('@/lib/api', () => ({
  profileApi: {
    get: () => mockProfileGet(),
    memberships: () => mockMemberships(),
    attendance: (...args: unknown[]) => mockAttendance(...args),
    classPasses: (...args: unknown[]) => mockClassPasses(...args),
    comps: (...args: unknown[]) => mockComps(...args),
  },
  subscriptionApi: {
    mine: (...args: unknown[]) => mockSubMine(...args),
    cancel: jest.fn(),
  },
}))

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@test.com' },
    studioId: 'studio-1',
    signOut: mockSignOut,
    session: { access_token: 'token' },
    loading: false,
    studioLoaded: true,
  }),
}))

import ProfileScreen from '../app/(tabs)/profile'

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfileGet.mockResolvedValue({
      name: 'Test User',
      email: 'test@test.com',
      total_classes: 42,
      this_month: 8,
      streak: 3,
      member_since: 'Jan 2026',
    })
    mockMemberships.mockResolvedValue([])
    mockAttendance.mockResolvedValue([])
    mockClassPasses.mockResolvedValue([])
    mockComps.mockResolvedValue([])
    mockSubMine.mockResolvedValue(null)
  })

  it('renders without crashing', async () => {
    const { toJSON } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(toJSON()).toBeTruthy()
    })
  })

  it('displays user name and stats', async () => {
    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('Test User')).toBeTruthy()
      expect(getByText('42')).toBeTruthy() // total classes
      expect(getByText('8')).toBeTruthy() // this month
      expect(getByText('3')).toBeTruthy() // streak
    })
  })

  it('displays member since date', async () => {
    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('Member since Jan 2026')).toBeTruthy()
    })
  })

  it('has tab navigation for memberships, attendance, settings', async () => {
    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('Memberships')).toBeTruthy()
      expect(getByText('Attendance')).toBeTruthy()
      expect(getByText('Settings')).toBeTruthy()
    })
  })

  it('shows no active memberships message', async () => {
    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('No active memberships')).toBeTruthy()
    })
  })

  it('switches to attendance tab', async () => {
    const { getByText } = render(<ProfileScreen />)

    await waitFor(() => {
      expect(getByText('Attendance')).toBeTruthy()
    })

    fireEvent.press(getByText('Attendance'))

    await waitFor(() => {
      expect(getByText('No attendance records yet')).toBeTruthy()
    })
  })

  it('switches to settings tab and shows sign out', async () => {
    const { getByText } = render(<ProfileScreen />)

    await waitFor(() => {
      expect(getByText('Settings')).toBeTruthy()
    })

    fireEvent.press(getByText('Settings'))

    await waitFor(() => {
      expect(getByText('Sign Out')).toBeTruthy()
      expect(getByText('Notification Preferences')).toBeTruthy()
      expect(getByText('Payment Methods')).toBeTruthy()
    })
  })

  it('renders subscription when present', async () => {
    mockSubMine.mockResolvedValue({
      id: 'sub-1',
      plan_name: 'Unlimited',
      status: 'active',
      current_period_end: '2026-04-01T00:00:00Z',
      cancel_at_period_end: false,
    })

    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('Subscription')).toBeTruthy()
      expect(getByText('Unlimited')).toBeTruthy()
      expect(getByText('Cancel Subscription')).toBeTruthy()
    })
  })

  it('renders class passes', async () => {
    mockClassPasses.mockResolvedValue([{
      id: 'pass-1',
      name: '10-Class Pack',
      remaining: 7,
      total: 10,
      expires_at: '2026-06-01',
    }])

    const { getByText } = render(<ProfileScreen />)
    await waitFor(() => {
      expect(getByText('10-Class Pack')).toBeTruthy()
      expect(getByText('7/10 left')).toBeTruthy()
    })
  })

  it('handles API errors gracefully', async () => {
    mockProfileGet.mockRejectedValue(new Error('Network error'))
    mockMemberships.mockRejectedValue(new Error('Network error'))

    const { toJSON } = render(<ProfileScreen />)
    await waitFor(() => {
      // Should render without crashing
      expect(toJSON()).toBeTruthy()
    })
  })
})
