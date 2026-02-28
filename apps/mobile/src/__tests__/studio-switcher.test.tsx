import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { StudioSwitcherHeader } from '../components/studio-switcher'

describe('StudioSwitcherHeader', () => {
  const defaultProps = {
    studios: [],
    currentStudio: null,
    showPicker: false,
    setShowPicker: jest.fn(),
    selectStudio: jest.fn(),
  }

  it('renders nothing when no studios and no current studio', () => {
    const { toJSON } = render(<StudioSwitcherHeader {...defaultProps} studios={[]} currentStudio={null} />)
    // With 0 studios and null currentStudio, single studio branch returns null
    expect(toJSON()).toBeNull()
  })

  it('renders studio name for single studio', () => {
    const studio = { id: 's1', name: 'Yoga Studio', discipline: 'yoga', role: 'member' }
    const { getByText } = render(
      <StudioSwitcherHeader {...defaultProps} studios={[studio]} currentStudio={studio} />
    )
    expect(getByText('Yoga Studio')).toBeTruthy()
  })

  it('renders dropdown arrow for multiple studios', () => {
    const studios = [
      { id: 's1', name: 'Yoga Studio', discipline: 'yoga', role: 'member' },
      { id: 's2', name: 'BJJ Gym', discipline: 'bjj', role: 'member' },
    ]
    const { getByText } = render(
      <StudioSwitcherHeader {...defaultProps} studios={studios} currentStudio={studios[0]!} />
    )
    expect(getByText('Yoga Studio')).toBeTruthy()
    // Should have dropdown indicator
    expect(getByText('\u25BC')).toBeTruthy()
  })

  it('calls setShowPicker when dropdown is pressed', () => {
    const studios = [
      { id: 's1', name: 'Yoga Studio', discipline: 'yoga', role: 'member' },
      { id: 's2', name: 'BJJ Gym', discipline: 'bjj', role: 'member' },
    ]
    const setShowPicker = jest.fn()
    const { getByText } = render(
      <StudioSwitcherHeader {...defaultProps} studios={studios} currentStudio={studios[0]!} setShowPicker={setShowPicker} />
    )
    fireEvent.press(getByText('Yoga Studio'))
    expect(setShowPicker).toHaveBeenCalledWith(true)
  })

  it('shows Select Studio when no current studio and multiple studios', () => {
    const studios = [
      { id: 's1', name: 'Yoga Studio', discipline: 'yoga', role: 'member' },
      { id: 's2', name: 'BJJ Gym', discipline: 'bjj', role: 'member' },
    ]
    const { getByText } = render(
      <StudioSwitcherHeader {...defaultProps} studios={studios} currentStudio={null} />
    )
    expect(getByText('Select Studio')).toBeTruthy()
  })

  it('does not show dropdown for single studio', () => {
    const studio = { id: 's1', name: 'Solo Studio', discipline: 'general', role: 'owner' }
    const setShowPicker = jest.fn()
    const { queryByText } = render(
      <StudioSwitcherHeader {...defaultProps} studios={[studio]} currentStudio={studio} setShowPicker={setShowPicker} />
    )
    // No dropdown indicator
    expect(queryByText('\u25BC')).toBeNull()
  })
})
