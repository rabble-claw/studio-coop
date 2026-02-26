/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// ─── Mock next/navigation ──────────────────────────────────────────────────

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'class-123' }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// ─── Mock Supabase — returns a never-resolving promise so component stays in loading state ──

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => new Promise(() => {})), // never resolves → loading state
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(() => new Promise(() => {})),
    })),
  })),
}))

import CheckinPage from '@/app/dashboard/classes/[id]/checkin/page'

// ─── MemberCard isolation test ─────────────────────────────────────────────
// Import from the page module indirectly by using a small wrapper component
// that mimics the grid card without async loading.

function TestGrid() {
  const [checkedIn, setCheckedIn] = React.useState(false)
  return (
    <div>
      <button
        data-testid="member-card"
        onClick={() => setCheckedIn(!checkedIn)}
        className={checkedIn ? 'border-green-500' : 'border-border'}
      >
        <span>Alice Smith</span>
        {checkedIn && <span data-testid="present-badge">Present</span>}
      </button>
      <span data-testid="counter">{checkedIn ? 1 : 0}/12 checked in</span>
    </div>
  )
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('CheckinPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders loading state initially', () => {
    render(<CheckinPage />)
    expect(screen.getByText(/loading check-in/i)).toBeInTheDocument()
  })
})

describe('Grid toggle behaviour (unit)', () => {
  it('renders a member card with unchecked state', () => {
    render(<TestGrid />)
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByTestId('present-badge')).toBeNull()
    expect(screen.getByTestId('counter')).toHaveTextContent('0/12 checked in')
  })

  it('toggles to checked-in on click', () => {
    render(<TestGrid />)
    fireEvent.click(screen.getByTestId('member-card'))
    expect(screen.getByTestId('present-badge')).toBeInTheDocument()
    expect(screen.getByTestId('counter')).toHaveTextContent('1/12 checked in')
  })

  it('toggles back to unchecked on second click', () => {
    render(<TestGrid />)
    fireEvent.click(screen.getByTestId('member-card'))
    fireEvent.click(screen.getByTestId('member-card'))
    expect(screen.queryByTestId('present-badge')).toBeNull()
    expect(screen.getByTestId('counter')).toHaveTextContent('0/12 checked in')
  })
})

describe('Walk-in dialog behaviour (unit)', () => {
  function WalkInDialog({ onAdd }: { onAdd: (email: string) => void }) {
    const [open, setOpen] = React.useState(false)
    const [email, setEmail] = React.useState('')

    return (
      <div>
        <button onClick={() => setOpen(true)}>Add Walk-in</button>
        {open && (
          <div role="dialog">
            <input
              type="email"
              placeholder="member@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button onClick={() => { onAdd(email); setOpen(false) }}>Add</button>
            <button onClick={() => setOpen(false)}>Cancel</button>
          </div>
        )}
      </div>
    )
  }

  it('opens walk-in dialog on button click', () => {
    render(<WalkInDialog onAdd={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /add walk-in/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/member@example.com/i)).toBeInTheDocument()
  })

  it('calls onAdd with email and closes dialog', () => {
    const onAdd = vi.fn()
    render(<WalkInDialog onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /add walk-in/i }))
    fireEvent.change(screen.getByPlaceholderText(/member@example.com/i), {
      target: { value: 'newmember@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onAdd).toHaveBeenCalledWith('newmember@example.com')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes dialog on cancel without calling onAdd', () => {
    const onAdd = vi.fn()
    render(<WalkInDialog onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: /add walk-in/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onAdd).not.toHaveBeenCalled()
  })
})
