'use client'

import { useState } from 'react'
import AdminShell from '@/components/admin-shell'

const HEALTH_CHECKS = [
  { label: 'API Server', status: 'healthy' as const, latency: '23ms', uptime: '99.98%' },
  { label: 'Database (Supabase)', status: 'healthy' as const, latency: '4ms', uptime: '99.99%' },
  { label: 'Stripe Integration', status: 'healthy' as const, latency: '142ms', uptime: '99.95%' },
  { label: 'Email (Resend)', status: 'healthy' as const, latency: '89ms', uptime: '99.90%' },
  { label: 'DNS / Custom Domains', status: 'healthy' as const, latency: '12ms', uptime: '99.99%' },
  { label: 'Asset Storage (R2)', status: 'healthy' as const, latency: '31ms', uptime: '99.97%' },
]

interface FeatureFlag {
  name: string
  label: string
  description: string
  enabled: boolean
}

const INITIAL_FLAGS: FeatureFlag[] = [
  { name: 'community_feed', label: 'Community Feed', description: 'Social feed for studio communities', enabled: true },
  { name: 'private_bookings', label: 'Private Bookings', description: '1-on-1 session booking system', enabled: true },
  { name: 'class_packages', label: 'Class Packages', description: 'Multi-class punch cards and bundles', enabled: true },
  { name: 'multi_studio_network', label: 'Multi-Studio Network', description: 'Cross-studio membership sharing', enabled: false },
  { name: 'ai_website_builder', label: 'AI Website Builder', description: 'AI-powered studio website generation', enabled: false },
  { name: 'local_payment_rails', label: 'Local Payment Rails (PIX/UPI)', description: 'Regional payment methods for emerging markets', enabled: false },
  { name: 'marketplace', label: 'Studio Marketplace', description: 'Public directory of all platform studios', enabled: false },
]

const DEPLOYMENT_INFO = [
  { label: 'Platform', value: 'Cloudflare Workers' },
  { label: 'Region', value: 'Global Edge' },
  { label: 'Runtime', value: 'Next.js 15 + Edge' },
  { label: 'Database', value: 'Supabase (PostgreSQL 17)' },
  { label: 'Last Deploy', value: '2026-02-27 10:32 UTC' },
  { label: 'Git SHA', value: 'e4f8c90' },
]

export default function SystemPage() {
  const [flags, setFlags] = useState(INITIAL_FLAGS)

  function toggleFlag(name: string) {
    setFlags((prev) =>
      prev.map((f) => (f.name === name ? { ...f, enabled: !f.enabled } : f))
    )
  }

  return (
    <AdminShell>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">System</h2>
        <p className="text-sm text-[var(--muted-foreground)]">Platform health, feature flags, and deployment info</p>
      </div>

      {/* Health Checks */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Service Health</h3>
        <div className="grid grid-cols-3 gap-4">
          {HEALTH_CHECKS.map((h) => (
            <div
              key={h.label}
              className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4"
            >
              <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                h.status === 'healthy' ? 'bg-emerald-400' : h.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              <div className="flex-1">
                <p className="font-medium">{h.label}</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-[var(--muted-foreground)]">Latency: {h.latency}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">Uptime: {h.uptime}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Feature Flags</h3>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {flags.map((f) => (
            <div key={f.name} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
              <div>
                <p className="font-medium">{f.label}</p>
                <p className="text-sm text-[var(--muted-foreground)]">{f.description}</p>
                <p className="mt-0.5 font-mono text-xs text-[var(--muted-foreground)]">{f.name}</p>
              </div>
              <button
                onClick={() => toggleFlag(f.name)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  f.enabled ? 'bg-emerald-600' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={f.enabled}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    f.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment Info */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h3 className="mb-4 text-lg font-bold">Deployment</h3>
        <dl className="grid grid-cols-3 gap-4">
          {DEPLOYMENT_INFO.map((d) => (
            <div key={d.label}>
              <dt className="text-sm text-[var(--muted-foreground)]">{d.label}</dt>
              <dd className="mt-1 font-medium">{d.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </AdminShell>
  )
}
