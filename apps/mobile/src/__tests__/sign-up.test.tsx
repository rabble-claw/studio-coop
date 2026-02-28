import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

const mockSignUp = jest.fn().mockResolvedValue({ error: null })
jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    session: null,
    user: null,
    loading: false,
    studioId: null,
    studioLoaded: true,
  }),
}))

import SignUpScreen from '../app/auth/sign-up'

describe('SignUpScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)
    expect(getByPlaceholderText('Full Name')).toBeTruthy()
    expect(getByPlaceholderText('Email')).toBeTruthy()
    expect(getByPlaceholderText('Password (min 6 characters)')).toBeTruthy()
    expect(getByText('Create account')).toBeTruthy()
    expect(getByText('Create Account')).toBeTruthy()
  })

  it('calls signUp with name, email, and password', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)

    fireEvent.changeText(getByPlaceholderText('Full Name'), 'Jane Doe')
    fireEvent.changeText(getByPlaceholderText('Email'), 'jane@test.com')
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'password123')
    fireEvent.press(getByText('Create account'))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('jane@test.com', 'password123', 'Jane Doe')
    })
  })

  it('sends undefined name when name is empty', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'jane@test.com')
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'password123')
    fireEvent.press(getByText('Create account'))

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith('jane@test.com', 'password123', undefined)
    })
  })

  it('shows success message after sign up', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'jane@test.com')
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'pass123')
    fireEvent.press(getByText('Create account'))

    await waitFor(() => {
      expect(getByText('Check your email to confirm your account!')).toBeTruthy()
    })
  })

  it('shows error on failed sign up', async () => {
    mockSignUp.mockResolvedValueOnce({ error: { message: 'Email already taken' } })
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'existing@test.com')
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'pass123')
    fireEvent.press(getByText('Create account'))

    await waitFor(() => {
      expect(getByText('Email already taken')).toBeTruthy()
    })
  })

  it('shows loading state during sign up', async () => {
    mockSignUp.mockImplementation(() => new Promise(() => {}))
    const { getByPlaceholderText, getByText } = render(<SignUpScreen />)

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@test.com')
    fireEvent.changeText(getByPlaceholderText('Password (min 6 characters)'), 'pass123')
    fireEvent.press(getByText('Create account'))

    await waitFor(() => {
      expect(getByText('Creating account...')).toBeTruthy()
    })
  })
})
