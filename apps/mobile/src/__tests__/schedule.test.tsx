import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

const mockScheduleList = jest.fn().mockResolvedValue([])
const mockBook = jest.fn().mockResolvedValue({})
const mockJoinWaitlist = jest.fn().mockResolvedValue({})
const mockPush = jest.fn()

jest.mock('@/lib/api', () => ({
  scheduleApi: { list: (...args: unknown[]) => mockScheduleList(...args) },
  bookingApi: {
    book: (...args: unknown[]) => mockBook(...args),
    joinWaitlist: (...args: unknown[]) => mockJoinWaitlist(...args),
  },
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    studioId: 'studio-1',
    session: { access_token: 'token' },
    loading: false,
    studioLoaded: true,
  }),
}))

import ScheduleScreen from '../app/(tabs)/schedule'

describe('ScheduleScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockScheduleList.mockResolvedValue([])
  })

  it('renders without crashing', async () => {
    const { toJSON } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(toJSON()).toBeTruthy()
    })
  })

  it('shows week navigation', async () => {
    const { getByText } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(getByText(/Prev/)).toBeTruthy()
      expect(getByText(/Next/)).toBeTruthy()
    })
  })

  it('shows empty state when no classes', async () => {
    const { getByText } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(getByText('No classes on this day')).toBeTruthy()
    })
  })

  it('renders classes with Book button', async () => {
    mockScheduleList.mockResolvedValue([{
      id: 'class-1',
      date: '2026-03-01',
      start_time: '10:00:00',
      end_time: '11:00:00',
      status: 'scheduled',
      booking_count: 5,
      max_capacity: 20,
      is_booked: false,
      template: { id: 'tmpl-1', name: 'Morning Yoga' },
      teacher: { name: 'Sarah' },
    }])

    const { getByText } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(getByText('Morning Yoga')).toBeTruthy()
      expect(getByText('Book')).toBeTruthy()
      expect(getByText(/5\/20 booked/)).toBeTruthy()
    })
  })

  it('shows Booked badge for already-booked classes', async () => {
    mockScheduleList.mockResolvedValue([{
      id: 'class-2',
      date: '2026-03-01',
      start_time: '10:00:00',
      end_time: '11:00:00',
      status: 'scheduled',
      booking_count: 10,
      max_capacity: 20,
      is_booked: true,
      template: { id: 'tmpl-1', name: 'Booked Class' },
      teacher: null,
    }])

    const { getByText } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(getByText('Booked')).toBeTruthy()
    })
  })

  it('shows Waitlist button for full classes', async () => {
    mockScheduleList.mockResolvedValue([{
      id: 'class-3',
      date: '2026-03-01',
      start_time: '10:00:00',
      end_time: '11:00:00',
      status: 'scheduled',
      booking_count: 20,
      max_capacity: 20,
      is_booked: false,
      template: { id: 'tmpl-1', name: 'Full Class' },
      teacher: null,
    }])

    const { getByText, getAllByText } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(getByText('Waitlist')).toBeTruthy()
      expect(getAllByText(/Full/).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('calls scheduleApi.list with studioId', async () => {
    render(<ScheduleScreen />)
    await waitFor(() => {
      expect(mockScheduleList).toHaveBeenCalledWith('studio-1', expect.stringContaining('from='))
    })
  })

  it('handles API errors gracefully', async () => {
    mockScheduleList.mockRejectedValue(new Error('Network error'))

    const { toJSON } = render(<ScheduleScreen />)
    await waitFor(() => {
      expect(toJSON()).toBeTruthy()
    })
  })
})
