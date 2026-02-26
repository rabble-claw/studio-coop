import { notFound } from 'next/navigation'
import { formatTime, formatDate } from '@/lib/utils'
import { isDemoMode, demoStudio, demoClasses, demoMembers, demoMembershipPlans } from '@/lib/demo-data'
import Link from 'next/link'
import Image from 'next/image'
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
  if (isDemoMode()) {
    if (slug !== demoStudio.slug) return null
    const classesByDate = demoClasses.reduce<Record<string, typeof demoClasses>>((acc, cls) => {
      if (!acc[cls.date]) acc[cls.date] = []
      acc[cls.date]!.push(cls)
      return acc
    }, {})
    return {
      studio: demoStudio,
      classesByDate,
      memberCount: demoMembers.length,
      plans: demoMembershipPlans as MembershipPlan[],
    }
  }

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

// Empire-specific content (will be data-driven later)
const empireContent = {
  tagline: 'Welcome to Empire!',
  description: "We're a queer-owned boutique studio in a gorgeously secret location right in the middle of Wellington's central Cuba Street! Our instructors all bring a love of sharing their skills with new learners to their lessons, and our classes are for all adults of all experience levels.",
  address: 'Level 1, 110 Cuba Street, Wellington, New Zealand',
  email: 'contact@empireaerialarts.com',
  social: {
    instagram: 'https://www.instagram.com/empireaerialarts/',
    facebook: 'https://www.facebook.com/EmpireAerialArtsNZ',
  },
  classCategories: [
    {
      name: 'Pole Technique',
      image: '/empire/pole-technique.jpg',
      description: 'Our pole technique classes follow a level structure of 1 to 5. If you are brand new to pole dance, Level 1 is perfect for you! If you are already a pole dancer and new to the studio, please get in touch to find out the best level for you.',
    },
    {
      name: 'Movement & Cirque',
      image: '/empire/movement-cirque.jpg',
      description: 'Our Movement & Cirque suite introduces you to dance, choreography, aerial apparatus technique, and incredibly fun cirque skills like Hula Hoop and Handbalance! Find a new way to have fun and move with this incredible collection.',
    },
    {
      name: 'Fitness & Development',
      image: '/empire/fitness.jpg',
      description: "New to fitness but can't get into enjoying the gym life? Keen to progress but can't quite touch your toes yet? Want to work on those splits and backbends? With our fitness and strength development classes you can gain active flexibility and add a little bit more cardio to your routine while enjoying our lush spaces!",
    },
  ],
  membershipText: "We know you'd like to give something a go before you leap all in, maybe you're visiting from out of town, or have a fiddly schedule that's hard to pin down — so all of our classes can be attended on a drop-in basis with prepaid class passes. But if you're ready to step up your journey and get those gorgeous gains, a membership will be the boost to take you there!",
}

export default async function PublicStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getStudioData(slug)
  if (!data) notFound()
  const { studio, classesByDate, memberCount, plans } = data
  const isEmpire = studio.slug === 'empire-aerial-arts'
  const content = isEmpire ? empireContent : null

  return (
    <div className="min-h-screen" style={{ 
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#706477',
      background: '#fff',
    }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          {isEmpire && (
            <img src="/empire/logo.jpg" alt="Empire Aerial Arts" className="h-10 w-10 rounded-full object-cover" />
          )}
          <span className="font-semibold text-lg" style={{ color: '#3d2e47', fontVariant: 'small-caps', letterSpacing: '0.05em' }}>
            {studio.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {content?.social.instagram && (
            <a href={content.social.instagram} target="_blank" rel="noopener" className="text-sm opacity-60 hover:opacity-100">
              Instagram
            </a>
          )}
          <Link
            href="/login"
            className="inline-flex items-center rounded-full border-2 px-5 py-2 text-sm font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
            style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
          >
            Book Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      {isEmpire && (
        <section className="relative w-full" style={{ height: '60vh', minHeight: '400px' }}>
          <img 
            src="/empire/hero.jpg" 
            alt="Empire Aerial Arts studio"
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.85) saturate(1.1)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3" style={{ fontVariant: 'small-caps', letterSpacing: '0.03em' }}>
              Welcome to Empire
            </h1>
            <p className="text-white/90 text-lg max-w-2xl">
              A queer-owned boutique studio on Cuba Street, Wellington
            </p>
          </div>
        </section>
      )}

      {/* About */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        {!isEmpire && (
          <>
            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold mb-4 capitalize" style={{ borderColor: '#d4d4d8' }}>
              {studio.discipline}
            </span>
            <h1 className="text-4xl font-bold mb-4" style={{ color: '#3d2e47' }}>{studio.name}</h1>
          </>
        )}
        <p className="text-lg leading-relaxed" style={{ color: '#706477' }}>
          {content?.description || studio.description}
        </p>
        {content && (
          <p className="mt-4 text-sm" style={{ color: '#9e8da8' }}>
            📍 {content.address}
          </p>
        )}
      </section>

      {/* Class Categories */}
      {content && (
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <h2 className="text-3xl font-bold text-center mb-3" style={{ color: '#3d2e47', fontVariant: 'small-caps' }}>
            Our Class Collection
          </h2>
          <p className="text-center mb-10" style={{ color: '#9e8da8' }}>
            We run an open timetable — attend any class any time you like!
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {content.classCategories.map((cat) => (
              <div key={cat.name} className="rounded-xl overflow-hidden border" style={{ borderColor: '#e8e0ec' }}>
                <div className="aspect-[4/3] relative">
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2" style={{ color: '#3d2e47', fontVariant: 'small-caps' }}>
                    {cat.name}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#706477' }}>
                    {cat.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
                            href="/login"
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
      {(content || plans.length > 0) && (
        <section className="py-16" id="membership">
          <div className="max-w-5xl mx-auto px-6">
            {isEmpire && (
              <div className="relative rounded-2xl overflow-hidden mb-10">
                <img src="/empire/membership.jpg" alt="Membership" className="w-full h-48 object-cover" style={{ filter: 'brightness(0.8)' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[#3d2e47]/80 to-transparent flex items-end justify-center pb-6">
                  <h2 className="text-3xl font-bold text-white" style={{ fontVariant: 'small-caps' }}>
                    Membership &amp; Pricing
                  </h2>
                </div>
              </div>
            )}

            {!isEmpire && (
              <h2 className="text-3xl font-bold text-center mb-3" style={{ color: '#3d2e47', fontVariant: 'small-caps' }}>
                Membership &amp; Pricing
              </h2>
            )}

            {content && (
              <p className="text-base leading-relaxed mb-10 text-center max-w-2xl mx-auto" style={{ color: '#706477' }}>
                {content.membershipText}
              </p>
            )}

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
                          href="/login"
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
                  href="/login"
                  className="inline-flex items-center rounded-full border-2 px-8 py-3 font-medium transition-colors hover:bg-[#7c3aed] hover:text-white hover:border-[#7c3aed]"
                  style={{ borderColor: '#7c3aed', color: '#7c3aed' }}
                >
                  See Membership Options
                </Link>
              </div>
            )}

            {/* Coupon code input — shown when plans are visible */}
            {plans.length > 0 && !isDemoMode() && (
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
            {content && (
              <>
                <a href={content.social.instagram} target="_blank" rel="noopener" className="hover:opacity-100 opacity-60">Instagram</a>
                <a href={content.social.facebook} target="_blank" rel="noopener" className="hover:opacity-100 opacity-60">Facebook</a>
                <span>{content.email}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span>Powered by</span>
            <Link href="/" className="font-medium hover:underline" style={{ color: '#7c3aed' }}>Studio Co-op</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
