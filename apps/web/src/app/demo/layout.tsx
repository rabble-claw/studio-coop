'use client'

import { DashboardShell } from '@/components/dashboard-shell'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell mode="demo" basePath="/demo">{children}</DashboardShell>
}
