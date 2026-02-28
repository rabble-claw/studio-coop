'use client'

import { DashboardShell } from '@/components/dashboard-shell'
import { ErrorBoundary } from '@/components/error-boundary'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardShell>
  )
}
