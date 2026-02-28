import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

// Mock API modules
const mockMyBookings = jest.fn().mockResolvedValue([])
const mockScheduleList = jest.fn().mockResolvedValue([])
const mockGetFeed = jest.fn().mockResolvedValue([])

jest.mock('@/lib/api', () => ({
  bookingApi: { myBookings: () => mockMyBookings() },
  scheduleApi: { list: (...args: unknown[]) => mockScheduleList(...args) },
  feedApi: { getFeed: (...args: unknown[]) => mockGetFeed(...args) },
  notificationApi: { unreadCount: jest.fn().mockResolvedValue({ count: 0 }) },
}))

// Use stable references to prevent infinite re-renders from useCallback deps
const mockUser = { id: 'user-1', email: 'test@test.com' }
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    studioId: 'studio-1',
    session: { access_token: 'mock-token' },
    loading: false,
    studioLoaded: true,
  }),
}))

import HomeScreen from '../app/(tabs)/index'

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMyBookings.mockResolvedValue([])
    mockScheduleList.mockResolvedValue([])
    mockGetFeed.mockResolvedValue([])
  })

  it('renders without crashing', async () => {
    const { toJSON } = render(<HomeScreen />)
    await waitFor(() => {
      expect(toJSON()).toBeTruthy()
    })
  })

  it('shows empty state when no data', async () => {
    const { findByText } = render(<HomeScreen />)
    expect(await findByText('Nothing here yet', {}, { timeout: 3000 })).toBeTruthy()
  })

  it('renders upcoming bookings when available', async () => {
    mockMyBookings.mockResolvedValue([{
      id: 'booking-1',
      status: 'confirmed',
      class_instance: {
        id: 'class-1',
        date: '2026-03-01',
        start_time: '09:00:00',
        end_time: '10:00:00',
        template: { name: 'Morning Flow' },
        teacher: { name: 'Sarah' },
      },
    }])

    const { findByText } = render(<HomeScreen />)
    expect(await findByText('Upcoming Classes', {}, { timeout: 3000 })).toBeTruthy()
    expect(await findByText('Morning Flow')).toBeTruthy()
    expect(await findByText('Booked')).toBeTruthy()
  })

  it('renders today classes section', async () => {
    mockScheduleList.mockResolvedValue([{
      id: 'class-2',
      date: '2026-03-01',
      start_time: '14:00:00',
      end_time: '15:00:00',
      status: 'scheduled',
      booking_count: 5,
      max_capacity: 20,
      template: { id: 'tmpl-1', name: 'Power Yoga' },
      teacher: { name: 'Mike' },
    }])

    const { findByText } = render(<HomeScreen />)
    expect(await findByText('Quick Book - Today', {}, { timeout: 3000 })).toBeTruthy()
    expect(await findByText('Power Yoga')).toBeTruthy()
    expect(await findByText('15 spots')).toBeTruthy()
  })

  it('shows "Full" for classes at capacity', async () => {
    mockScheduleList.mockResolvedValue([{
      id: 'class-3',
      date: '2026-03-01',
      start_time: '14:00:00',
      end_time: '15:00:00',
      status: 'scheduled',
      booking_count: 20,
      max_capacity: 20,
      template: { id: 'tmpl-1', name: 'Full Class' },
      teacher: null,
    }])

    const { findByText } = render(<HomeScreen />)
    expect(await findByText('Waitlist', {}, { timeout: 3000 })).toBeTruthy()
  })

  it('renders feed posts', async () => {
    mockGetFeed.mockResolvedValue([{
      id: 'post-1',
      content: 'Great class today!',
      post_type: 'text',
      created_at: '2026-03-01T10:00:00Z',
      user: { name: 'Alice' },
      class_name: 'Morning Flow',
    }])

    const { findByText } = render(<HomeScreen />)
    expect(await findByText('Recent Feed', {}, { timeout: 3000 })).toBeTruthy()
    expect(await findByText('Alice')).toBeTruthy()
    expect(await findByText('Great class today!')).toBeTruthy()
  })

  it('handles API errors without crashing', async () => {
    mockMyBookings.mockRejectedValue(new Error('Network error'))
    mockScheduleList.mockRejectedValue(new Error('Network error'))
    mockGetFeed.mockRejectedValue(new Error('Network error'))

    const { findByText } = render(<HomeScreen />)
    // After errors, the catch handlers return [] and loading becomes false
    expect(await findByText('Nothing here yet', {}, { timeout: 3000 })).toBeTruthy()
  })
})
