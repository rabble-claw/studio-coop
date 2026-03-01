/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock next/link — renders a plain <a> so we can test hrefs without Next.js router
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import LandingPage from '@/app/page'

describe('LandingPage', () => {
  it('renders without crashing', () => {
    const { container } = render(<LandingPage />)
    expect(container).toBeTruthy()
  })

  it('shows the Studio Co-op brand name', () => {
    render(<LandingPage />)
    const brandNames = screen.getAllByText('Studio Co-op')
    expect(brandNames.length).toBeGreaterThanOrEqual(1)
  })

  it('shows the hero headline', () => {
    render(<LandingPage />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Your studio')
    expect(h1).toHaveTextContent('platform')
  })

  it('shows navigation log in link', () => {
    render(<LandingPage />)
    const loginLinks = screen.getAllByRole('link', { name: /log in/i })
    expect(loginLinks.length).toBeGreaterThanOrEqual(1)
    expect(loginLinks[0]).toHaveAttribute('href', '/login')
  })

  it('shows a "Start free" call-to-action link', () => {
    render(<LandingPage />)
    const startFreeLinks = screen.getAllByRole('link', { name: /start free/i })
    expect(startFreeLinks.length).toBeGreaterThanOrEqual(1)
    expect(startFreeLinks[0]).toHaveAttribute('href', '/login?mode=signup')
  })

  it('shows the demo link', () => {
    render(<LandingPage />)
    const demoLinks = screen.getAllByRole('link', { name: /see the demo/i })
    expect(demoLinks.length).toBeGreaterThanOrEqual(1)
    expect(demoLinks[0]).toHaveAttribute('href', '/demo')
  })

  it('shows "How it works" section', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeInTheDocument()
  })

  it('shows the three onboarding steps', () => {
    render(<LandingPage />)
    expect(screen.getByText(/set up your studio/i)).toBeInTheDocument()
    expect(screen.getByText(/members book classes/i)).toBeInTheDocument()
    expect(screen.getByText(/teach and connect/i)).toBeInTheDocument()
  })

  it('shows "Everything your studio needs" features section', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { name: /everything your studio needs/i })).toBeInTheDocument()
  })

  it('shows all six feature cards', () => {
    render(<LandingPage />)
    expect(screen.getByText(/class scheduling/i)).toBeInTheDocument()
    expect(screen.getByText(/member community/i)).toBeInTheDocument()
    expect(screen.getByText(/photo check-in/i)).toBeInTheDocument()
    expect(screen.getByText(/mobile first/i)).toBeInTheDocument()
    expect(screen.getByText(/privacy by default/i)).toBeInTheDocument()
    expect(screen.getByText(/built for indies/i)).toBeInTheDocument()
  })

  it('shows the Empire Aerial Arts testimonial', () => {
    render(<LandingPage />)
    const mentions = screen.getAllByText(/empire aerial arts/i)
    expect(mentions.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/cuba street/i)).toBeInTheDocument()
  })

  it('shows the bottom CTA', () => {
    render(<LandingPage />)
    expect(screen.getByRole('heading', { name: /ready to build your community/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /get started.*free/i })).toBeInTheDocument()
  })

  it('shows the footer', () => {
    render(<LandingPage />)
    expect(screen.getByText(/made in aotearoa/i)).toBeInTheDocument()
  })
})
