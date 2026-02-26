'use client'

import { useState } from 'react'

interface Studio {
  id: string
  name: string
  slug: string
  discipline: string
  tier: string
  members: number
  revenue_cents: number
  status: 'active' | 'pending' | 'suspended'
  created_at: string
}

interface PlatformStats {
  totalStudios: number
  activeMembers: number
  totalBookings: number
  monthlyRevenue: number
  coopMembers: number
}

const DEMO_STATS: PlatformStats = {
  totalStudios: 12,
  activeMembers: 584,
  totalBookings: 3247,
  monthlyRevenue: 118800,
  coopMembers: 8,
}

const DEMO_STUDIOS: Studio[] = [
  { id: '1', name: 'Empire Aerial Arts', slug: 'empire-aerial', discipline: 'aerial', tier: 'growth', members: 47, revenue_cents: 461300, status: 'active', created_at: '2026-01-15' },
  { id: '2', name: 'Wellington Yoga Collective', slug: 'welly-yoga', discipline: 'yoga', tier: 'starter', members: 82, revenue_cents: 812600, status: 'active', created_at: '2026-01-22' },
  { id: '3', name: 'CrossFit Cuba St', slug: 'cf-cuba', discipline: 'crossfit', tier: 'growth', members: 124, revenue_cents: 1487200, status: 'active', created_at: '2026-02-01' },
  { id: '4', name: 'Dance Central', slug: 'dance-central', discipline: 'dance', tier: 'starter', members: 35, revenue_cents: 277200, status: 'active', created_at: '2026-02-10' },
  { id: '5', name: 'Barre & Beyond', slug: 'barre-beyond', discipline: 'barre', tier: 'growth', members: 58, revenue_cents: 574200, status: 'active', created_at: '2026-02-15' },
  { id: '6', name: 'Flow Pilates Studio', slug: 'flow-pilates', discipline: 'pilates', tier: 'starter', members: 0, revenue_cents: 0, status: 'pending', created_at: '2026-02-25' },
]

export default function AdminDashboard() {
  const [tab, setTab] = useState<'overview' | 'studios' | 'coop' | 'system'>('overview')

  const styles = {
    container: { maxWidth: 1200, margin: '0 auto', padding: '24px' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 } as const,
    title: { fontSize: 24, fontWeight: 800, letterSpacing: -0.5 } as const,
    nav: { display: 'flex', gap: 4, background: '#18181b', borderRadius: 12, padding: 4 } as const,
    navBtn: (active: boolean) => ({
      padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
      background: active ? '#27272a' : 'transparent', color: active ? '#fafafa' : '#71717a',
      border: 'none', cursor: 'pointer',
    } as const),
    grid: (cols: number) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 } as const),
    card: { background: '#18181b', border: '1px solid #27272a', borderRadius: 12, padding: 24 } as const,
    cardLabel: { fontSize: 13, color: '#71717a', marginBottom: 4 } as const,
    cardValue: { fontSize: 32, fontWeight: 800 } as const,
    table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
    th: { textAlign: 'left' as const, padding: '12px 16px', borderBottom: '1px solid #27272a', color: '#71717a', fontWeight: 600, fontSize: 13 },
    td: { padding: '12px 16px', borderBottom: '1px solid #27272a' },
    badge: (color: string) => ({
      display: 'inline-block', padding: '2px 8px', borderRadius: 100, fontSize: 12, fontWeight: 600,
      background: color === 'green' ? '#052e16' : color === 'yellow' ? '#422006' : '#27272a',
      color: color === 'green' ? '#4ade80' : color === 'yellow' ? '#fbbf24' : '#71717a',
    }),
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>🏛️ Studio Co-op Admin</div>
          <div style={{ color: '#71717a', fontSize: 14 }}>Platform management & cooperative governance</div>
        </div>
      </div>

      <div style={{ ...styles.nav, marginBottom: 24 }}>
        {(['overview', 'studios', 'coop', 'system'] as const).map(t => (
          <button key={t} style={styles.navBtn(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div style={styles.grid(5)}>
            {[
              { label: 'Studios', value: DEMO_STATS.totalStudios },
              { label: 'Active Members', value: DEMO_STATS.activeMembers.toLocaleString() },
              { label: 'Bookings (30d)', value: DEMO_STATS.totalBookings.toLocaleString() },
              { label: 'MRR', value: `$${(DEMO_STATS.monthlyRevenue / 100).toLocaleString()}` },
              { label: 'Co-op Members', value: DEMO_STATS.coopMembers },
            ].map(s => (
              <div key={s.label} style={styles.card}>
                <div style={styles.cardLabel}>{s.label}</div>
                <div style={styles.cardValue}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ ...styles.card, marginTop: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Recent Studios</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Studio</th>
                  <th style={styles.th}>Discipline</th>
                  <th style={styles.th}>Members</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_STUDIOS.map(s => (
                  <tr key={s.id}>
                    <td style={styles.td}><strong>{s.name}</strong><br/><span style={{color:'#71717a',fontSize:12}}>{s.slug}.studio.coop</span></td>
                    <td style={styles.td}>{s.discipline}</td>
                    <td style={styles.td}>{s.members}</td>
                    <td style={styles.td}><span style={styles.badge(s.status === 'active' ? 'green' : 'yellow')}>{s.status}</span></td>
                    <td style={styles.td}>{s.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'studios' && (
        <div style={styles.card}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>All Studios ({DEMO_STUDIOS.length})</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Studio</th>
                <th style={styles.th}>Tier</th>
                <th style={styles.th}>Members</th>
                <th style={styles.th}>Revenue</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_STUDIOS.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><strong>{s.name}</strong></td>
                  <td style={styles.td}>{s.tier}</td>
                  <td style={styles.td}>{s.members}</td>
                  <td style={styles.td}>${(s.revenue_cents / 100).toLocaleString()}</td>
                  <td style={styles.td}><span style={styles.badge(s.status === 'active' ? 'green' : 'yellow')}>{s.status}</span></td>
                  <td style={styles.td}>
                    <button style={{ background: '#27272a', border: 'none', color: '#fafafa', padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'coop' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={styles.card}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Cooperative Governance</h3>
            <div style={styles.grid(3)}>
              <div>
                <div style={styles.cardLabel}>Member Studios</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>8</div>
                <div style={{ color: '#71717a', fontSize: 12 }}>of 12 total studios</div>
              </div>
              <div>
                <div style={styles.cardLabel}>Voting Members</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>5</div>
                <div style={{ color: '#71717a', fontSize: 12 }}>12+ months membership</div>
              </div>
              <div>
                <div style={styles.cardLabel}>Next Election</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>Q3</div>
                <div style={{ color: '#71717a', fontSize: 12 }}>Board of directors</div>
              </div>
            </div>
          </div>
          <div style={styles.card}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Equity Tracker</h3>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Studio</th>
                  <th style={styles.th}>Months</th>
                  <th style={styles.th}>Total Paid</th>
                  <th style={styles.th}>Equity %</th>
                  <th style={styles.th}>Voting</th>
                </tr>
              </thead>
              <tbody>
                {DEMO_STUDIOS.filter(s => s.status === 'active').slice(0, 5).map((s, i) => {
                  const months = Math.floor((Date.now() - new Date(s.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1
                  const paid = months * 99
                  const equity = (paid / (5 * 99 * 12)) * 100 // simplified
                  return (
                    <tr key={s.id}>
                      <td style={styles.td}>{s.name}</td>
                      <td style={styles.td}>{months}</td>
                      <td style={styles.td}>${paid}</td>
                      <td style={styles.td}>{equity.toFixed(1)}%</td>
                      <td style={styles.td}>{months >= 12 ? '✅' : `${12 - months} months to go`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'system' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={styles.card}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>System Status</h3>
            <div style={styles.grid(4)}>
              {[
                { label: 'API', status: '✅ Healthy', latency: '23ms' },
                { label: 'Database', status: '✅ Healthy', latency: '4ms' },
                { label: 'Stripe', status: '✅ Connected', latency: '142ms' },
                { label: 'Email (Resend)', status: '✅ Connected', latency: '89ms' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 13, color: '#71717a' }}>{s.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{s.status}</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>{s.latency}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={styles.card}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Feature Flags</h3>
            {[
              { name: 'community_feed', label: 'Community Feed', enabled: true },
              { name: 'private_bookings', label: 'Private Bookings', enabled: true },
              { name: 'multi_studio_network', label: 'Multi-Studio Network', enabled: false },
              { name: 'ai_website_builder', label: 'AI Website Builder', enabled: false },
              { name: 'local_payment_rails', label: 'Local Payment Rails (PIX/UPI)', enabled: false },
            ].map(f => (
              <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #27272a' }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{f.label}</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>{f.name}</div>
                </div>
                <span style={styles.badge(f.enabled ? 'green' : 'gray')}>{f.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
