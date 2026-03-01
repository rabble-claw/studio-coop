import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatTime, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { CouponInput } from '@/components/coupon-input'

type MembershipPlan = {
  id: string
  name: string
  description?: string | null
  type: string
  price_cents: number
  currency: string
  interval: string
  class_limit?: number | null
  validity_days?: number | null
  active: boolean
  sort_order: number
}

function formatPlanPrice(plan: MembershipPlan): string {
  const amount = (plan.price_cents / 100).toFixed(2).replace(/\.00$/, '')
  const currency = plan.currency.toUpperCase()
  const symbol = currency === 'NZD' ? 'NZ$' : currency === 'AUD' ? 'A$' : '$'
  return `${symbol}${amount}`
}

function formatPlanInterval(plan: MembershipPlan): string {
  if (plan.interval === 'month') return '/ month'
  if (plan.interval === 'year') return '/ year'
  return ''
}

async function getStudioData(slug: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: studio } = await supabase.from('studios').select('*').eq('slug', slug).single()
  if (!studio) return null

  const today = new Date().toISOString().split('T')[0]
  const { data: classes } = await supabase
    .from('class_instances')
    .select('*, teacher:users!class_instances_teacher_id_fkey(name), template:class_templates!class_instances_template_id_fkey(name, description)')
    .eq('studio_id', studio.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date')
    .order('start_time')
    .limit(20)

  const { count: memberCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studio.id)
    .eq('status', 'active')

  const { data: plans } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('studio_id', studio.id)
    .eq('active', true)
    .order('sort_order')

  const classesByDate = (classes ?? []).reduce<Record<string, typeof classes>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  return {
    studio,
    classesByDate,
    memberCount: memberCount ?? 0,
    plans: (plans ?? []) as MembershipPlan[],
  }
}

const RESERVED_SLUGS = ['api', 'login', 'dashboard', 'demo', 'admin', 'signup', 'forgot-password', 'explore']

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (RESERVED_SLUGS.includes(slug)) return {}
  const data = await getStudioData(slug)
  if (!data) return {}
  const { studio } = data
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const address = settings.address as string | undefined
  const description = studio.description ?? `${studio.name} — ${studio.discipline} studio${address ? ` in ${address}` : ''}. View schedule and pricing on Studio Co-op.`
  return {
    title: `${studio.name} | Studio Co-op`,
    description,
    openGraph: {
      title: studio.name,
      description,
      type: 'website',
      ...(studio.logo_url ? { images: [{ url: studio.logo_url }] } : {}),
    },
  }
}

export default async function PublicStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (RESERVED_SLUGS.includes(slug)) notFound()
  const data = await getStudioData(slug)
  if (!data) notFound()
  const { studio, classesByDate, memberCount, plans } = data
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const address = settings.address as string | undefined
  const studioEmail = settings.email as string | undefined
  const instagram = settings.instagram as string | undefined
  const facebook = settings.facebook as string | undefined

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: studio.name,
    description: studio.description ?? undefined,
    sport: studio.discipline,
    ...(address ? { address: { '@type': 'PostalAddress', streetAddress: address } } : {}),
    ...(studio.logo_url ? { image: studio.logo_url } : {}),
    ...(studioEmail ? { email: studioEmail } : {}),
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://studio.coop'}/${slug}`,
  }

  return (
    <div className="min-h-screen" style={{
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#706477',
      background: '#fff',
    }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          {studio.logo_url && (
            <img src={studio.logo_url} alt={studio.name} className="h-10 w-10 rounded-full object-cover" />
          )}
          <span className="font-semibold text-lg" style={{ color: '#3d2e47', fontVariant: 'small-caps', letterSpacing: '0.05em' }}>
            {studio.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {instagram && (
            <a href={instagram} target="_blank" rel="noopener" className="text-sm opacity-60 hover:opacity-100">
              Instagram
            </a>
          )}
          <Link
            href={`/login?studio=${slug}`}
            className="inline-flex items-center rounded-full border-2 px-5 py-2 text-sm font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            Book Now
          </Link>
        </div>
      </nav>

      {/* About */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold mb-4 capitalize" style={{ borderColor: '#d4d4d8' }}>
          {studio.discipline}
        </span>
        <h1 className="text-4xl font-bold mb-4" style={{ color: '#3d2e47' }}>{studio.name}</h1>
        {studio.description && (
          <p className="text-lg leading-relaxed" style={{ color: '#706477' }}>
            {studio.description}
          </p>
        )}
        {address && (
          <p className="mt-4 text-sm" style={{ color: '#9e8da8' }}>
            {address}
          </p>
        )}
      </section>

      {/* Schedule */}
      <section className="py-16" style={{ background: '#faf7fc' }}>
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-3" style={{ color: '#3d2e47', fontVariant: 'small-caps' }}>
            Upcoming Classes
          </h2>
          <p className="text-center mb-10" style={{ color: '#9e8da8' }}>
            Weekday evenings & weekend daytimes
          </p>

          {Object.keys(classesByDate).length === 0 ? (
            <p className="text-center py-12" style={{ color: '#9e8da8' }}>No upcoming classes scheduled.</p>
          ) : (
            <div className="space-y-8">
              {Object.entries(classesByDate).slice(0, 5).map(([date, dayClasses]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: '#9e8da8' }}>
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {dayClasses!.map((cls) => (
                      <div key={cls.id} className="rounded-xl bg-white shadow-sm border p-4 flex items-center justify-between" style={{ borderColor: '#e8e0ec' }}>
                        <div>
                          <div className="font-medium" style={{ color: '#3d2e47' }}>{cls.template?.name ?? 'Class'}</div>
                          <div className="text-sm" style={{ color: '#9e8da8' }}>
                            {formatTime(cls.start_time)} — {formatTime(cls.end_time)}
                            {cls.teacher && ` · ${cls.teacher.name}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-medium" style={{ color: cls.max_capacity - (cls.booked_count ?? 0) <= 2 ? '#ef4444' : '#3d2e47' }}>
                              {cls.max_capacity - (cls.booked_count ?? 0)} spots
                            </div>
                          </div>
                          <Link
                            href={`/login?studio=${slug}`}
                            className="inline-flex items-center rounded-full border-2 px-4 py-1.5 text-xs font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
                            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                          >
                            Book
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Membership & Pricing */}
      {plans.length > 0 && (
        <section className="py-16" id="membership">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ color: '#3d2e47', fontVariant: 'small-caps' }}>
              Membership &amp; Pricing
            </h2>

            {plans.length > 0 ? (
              <div className={`grid gap-6 ${plans.length === 1 ? 'max-w-sm mx-auto' : plans.length === 2 ? 'md:grid-cols-2 max-w-2xl mx-auto' : 'md:grid-cols-3'}`}>
                {plans.map((plan) => {
                  const isUnlimited = plan.type === 'unlimited'
                  return (
                    <div
                      key={plan.id}
                      className="rounded-2xl border-2 p-6 flex flex-col"
                      style={{
                        borderColor: isUnlimited ? '#7c3aed' : '#e8e0ec',
                        background: isUnlimited ? '#faf7ff' : '#fff',
                      }}
                    >
                      {isUnlimited && (
                        <div className="mb-3">
                          <span
                            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ background: '#7c3aed', color: '#fff' }}
                          >
                            Most popular
                          </span>
                        </div>
                      )}
                      <h3 className="text-lg font-bold mb-1" style={{ color: '#3d2e47' }}>
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className="text-sm leading-relaxed mb-4" style={{ color: '#706477' }}>
                          {plan.description}
                        </p>
                      )}
                      <div className="mt-auto">
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-3xl font-bold" style={{ color: '#3d2e47' }}>
                            {formatPlanPrice(plan)}
                          </span>
                          {formatPlanInterval(plan) && (
                            <span className="text-sm" style={{ color: '#9e8da8' }}>
                              {formatPlanInterval(plan)}
                            </span>
                          )}
                        </div>
                        {plan.class_limit && plan.type === 'class_pack' && (
                          <p className="text-xs mb-1" style={{ color: '#9e8da8' }}>
                            {plan.class_limit} classes
                            {plan.validity_days ? ` · valid ${plan.validity_days} days` : ''}
                          </p>
                        )}
                        {plan.type === 'limited' && plan.class_limit && (
                          <p className="text-xs mb-1" style={{ color: '#9e8da8' }}>
                            Up to {plan.class_limit} classes / month
                          </p>
                        )}
                        <Link
                          href={`/login?studio=${slug}`}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-full border-2 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
                          style={{
                            borderColor: '#7c3aed',
                            color: isUnlimited ? '#fff' : '#7c3aed',
                            background: isUnlimited ? '#7c3aed' : 'transparent',
                          }}
                        >
                          {plan.type === 'drop_in' ? 'Book a class' : plan.interval === 'once' ? 'Buy now' : 'Get started'}
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center">
                <Link
                  href={`/login?studio=${slug}`}
                  className="inline-flex items-center rounded-full border-2 px-8 py-3 font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
                  style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                >
                  See Membership Options
                </Link>
              </div>
            )}

            {/* Coupon code input — shown when plans are visible */}
            {plans.length > 0 && (
              <div className="mt-8 text-center">
                <CouponInput studioId={studio.id} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Powered by */}
      <footer className="border-t py-8" style={{ borderColor: '#e8e0ec' }}>
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm" style={{ color: '#9e8da8' }}>
          <div className="flex items-center gap-4">
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener" className="hover:opacity-100 opacity-60">Instagram</a>
            )}
            {facebook && (
              <a href={facebook} target="_blank" rel="noopener" className="hover:opacity-100 opacity-60">Facebook</a>
            )}
            {studioEmail && <span>{studioEmail}</span>}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="hover:underline" style={{ color: '#7c3aed' }}>Browse more studios</Link>
            <span>·</span>
            <span>Powered by</span>
            <Link href="/" className="font-medium hover:underline" style={{ color: '#7c3aed' }}>Studio Co-op</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
