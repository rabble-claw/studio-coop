import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

// Mock auth context
const mockSignIn = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    session: null,
    user: null,
    loading: false,
    studioId: null,
    studioLoaded: true,
  }),
}))

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import SignInScreen from '../app/auth/sign-in'

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)
    expect(getByPlaceholderText('Email')).toBeTruthy()
    expect(getByPlaceholderText('Password')).toBeTruthy()
    expect(getByText('Sign in')).toBeTruthy()
    expect(getByText('Studio Co-op')).toBeTruthy()
  })

  it('renders all form elements', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)
    expect(getByPlaceholderText('Email')).toBeTruthy()
    expect(getByPlaceholderText('Password')).toBeTruthy()
    expect(getByText('Sign in')).toBeTruthy()
    expect(getByText('Forgot password?')).toBeTruthy()
  })

  it('shows error on failed sign in', async () => {
    mockSignIn.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } })
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com')
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong')
    fireEvent.press(getByText('Sign in'))

    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeTruthy()
    })
  })

  it('calls signIn with email and password', async () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'user@test.com')
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123')
    fireEvent.press(getByText('Sign in'))

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('user@test.com', 'password123')
    })
  })

  it('shows loading state during sign in', async () => {
    // Make signIn hang
    mockSignIn.mockImplementation(() => new Promise(() => {}))
    const { getByPlaceholderText, getByText } = render(<SignInScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com')
    fireEvent.changeText(getByPlaceholderText('Password'), 'password')
    fireEvent.press(getByText('Sign in'))

    await waitFor(() => {
      expect(getByText('Signing in...')).toBeTruthy()
    })
  })

  it('switches to forgot password mode', async () => {
    const { getByText, getByPlaceholderText } = render(<SignInScreen />)

    // Enter email first
    fireEvent.changeText(getByPlaceholderText('Email'), 'user@test.com')

    // Switch to forgot password
    fireEvent.press(getByText('Forgot password?'))

    await waitFor(() => {
      expect(getByText('Reset Password')).toBeTruthy()
      expect(getByText('Send Reset Link')).toBeTruthy()
      expect(getByText('Back to sign in')).toBeTruthy()
    })
  })

  it('can return from forgot password mode', async () => {
    const { getByText } = render(<SignInScreen />)

    fireEvent.press(getByText('Forgot password?'))

    await waitFor(() => {
      expect(getByText('Reset Password')).toBeTruthy()
    })

    fireEvent.press(getByText('Back to sign in'))

    await waitFor(() => {
      expect(getByText('Studio Co-op')).toBeTruthy()
    })
  })
})
