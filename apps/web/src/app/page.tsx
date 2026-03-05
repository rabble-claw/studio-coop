import type { ReactNode } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const HERO_METRICS = [
  { value: '5 min', label: 'Setup from scratch' },
  { value: '30 sec', label: 'Average class check-in' },
  { value: '$0', label: 'To launch your studio page' },
]

const OUTCOME_PILLARS = [
  {
    title: 'No corporate bloat',
    description: 'Scheduling, check-in, and community in one workflow built for independents.',
    stat: 'Lean stack',
  },
  {
    title: 'Community-first retention',
    description: 'Private class feeds keep connection inside your studio after every session.',
    stat: 'Higher return visits',
  },
  {
    title: 'Mobile by default',
    description: 'Teachers and members both run daily operations from a phone, not a front desk.',
    stat: 'No app install needed',
  },
]

const STEPS = [
  {
    step: '1',
    title: 'Set up your studio',
    description: 'Add your studio details, schedule, and teachers. Your public page goes live instantly.',
  },
  {
    step: '2',
    title: 'Members book classes',
    description: 'Share your link and let members join, browse classes, and book from their phone.',
  },
  {
    step: '3',
    title: 'Teach and connect',
    description: 'Check in students with a photo grid, then keep momentum with class-only community posts.',
  },
]

const FEATURES = [
  {
    icon: <CalendarIcon />,
    title: 'Class Scheduling',
    description: 'Recurring templates, one-offs, waitlists, capacity controls, and instant updates for members.',
  },
  {
    icon: <UsersIcon />,
    title: 'Member Community',
    description: 'Post-class feeds visible only to attendees so your people connect without public social noise.',
  },
  {
    icon: <CheckCircleIcon />,
    title: 'Photo Check-in',
    description: 'Tap faces to mark attendance and move from arrivals to class start in under 30 seconds.',
  },
  {
    icon: <PhoneIcon />,
    title: 'Mobile First',
    description: 'Built for the way studios actually run: quick actions, clear cards, and no desktop dependency.',
  },
  {
    icon: <ShieldIcon />,
    title: 'Privacy by Default',
    description: 'Class conversations stay between attendees and teachers, with no public profile pressure.',
  },
  {
    icon: <SparklesIcon />,
    title: 'Built for Indies',
    description: 'Pole, aerial, BJJ, yoga, dance, pilates, and hybrid studios all fit naturally on Co-op.',
  },
]

export default function LandingPage() {
  return (
    <div className="marketing-page relative isolate min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-x-0 top-[-14rem] h-[32rem] marketing-glow" />
      <div className="pointer-events-none absolute left-[-8rem] top-[22rem] h-72 w-72 rounded-full bg-[#F1B074]/25 blur-3xl" />
      <div className="pointer-events-none absolute right-[-10rem] top-[40rem] h-[24rem] w-[24rem] rounded-full bg-[#2E7D6D]/20 blur-3xl" />

      <header className="sticky top-0 z-30 border-b border-white/50 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm">
              <span className="text-sm font-bold text-white">SC</span>
            </div>
            <span className="marketing-display text-lg font-semibold tracking-tight">Studio Co-op</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/explore" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
              Explore Studios
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Log in
            </Link>
            <Button asChild size="sm" className="rounded-full px-5">
              <Link href="/login">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-16 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:pt-20">
          <div>
            <div className="marketing-reveal inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Built for indie studios
            </div>

            <h1 className="marketing-display marketing-reveal mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-foreground [animation-delay:110ms] sm:text-6xl lg:text-7xl">
              Your studio,
              <br />
              your community,
              <br />
              your <span className="text-primary">platform</span>.
            </h1>

            <p className="marketing-reveal mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground [animation-delay:210ms] sm:text-xl">
              Studio Co-op is the management platform that puts relationships first. Run scheduling,
              attendance, and private community in one place without enterprise software overhead.
            </p>

            <div className="marketing-reveal mt-9 flex flex-wrap items-center gap-4 [animation-delay:310ms]">
              <Button asChild size="lg" className="h-12 rounded-full px-8">
                <Link href="/login?mode=signup">Start free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-12 rounded-full border-2 px-8">
                <Link href="/demo">See the demo</Link>
              </Button>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {HERO_METRICS.map((metric, index) => (
                <div
                  key={metric.label}
                  className="marketing-reveal rounded-2xl border border-white/70 bg-card/75 p-4 shadow-sm [animation-delay:420ms]"
                  style={{ animationDelay: `${420 + index * 90}ms` }}
                >
                  <div className="marketing-display text-2xl font-semibold text-foreground">{metric.value}</div>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="marketing-reveal relative [animation-delay:260ms]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-card p-3 shadow-[0_30px_80px_-42px_rgba(17,25,40,0.5)]">
              <img
                src="/empire/hero.jpg"
                alt="Aerial arts class at Empire Aerial Arts with pole, silks, and hoop"
                className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
              />

              <div className="absolute left-7 top-7 max-w-[13rem] rounded-2xl border border-white/70 bg-white/92 p-3 shadow-lg backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today</p>
                <p className="mt-1 text-sm font-semibold text-foreground">5 classes running</p>
                <p className="text-xs text-muted-foreground">Check-ins flowing in real time</p>
              </div>
            </div>

            <div className="marketing-float absolute -bottom-8 -left-7 hidden w-48 overflow-hidden rounded-2xl border border-white/80 bg-card/95 shadow-xl sm:block">
              <img
                src="/assets/marketing/schedule-clean.png"
                alt="Class schedule on Studio Co-op"
                className="h-auto w-full"
              />
            </div>
            <div className="marketing-float absolute -right-8 bottom-6 hidden w-44 overflow-hidden rounded-2xl border border-white/80 bg-card/95 shadow-xl [animation-delay:350ms] md:block">
              <img
                src="/assets/marketing/members-clean.png"
                alt="Member roster in Studio Co-op"
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/70">
          <div className="mx-auto grid w-full max-w-6xl gap-5 px-6 py-12 md:grid-cols-3">
            {OUTCOME_PILLARS.map((pillar, index) => (
              <div
                key={pillar.title}
                className="marketing-reveal rounded-2xl border border-white/70 bg-background/75 p-6 shadow-sm [animation-delay:120ms]"
                style={{ animationDelay: `${160 + index * 80}ms` }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{pillar.stat}</p>
                <h2 className="marketing-display mt-3 text-2xl font-semibold tracking-tight text-foreground">
                  {pillar.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Product tour</p>
            <h2 className="marketing-display mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              The full studio flow in one calm dashboard
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Keep classes full, reduce front-desk bottlenecks, and follow member engagement without jumping
              between disconnected tools.
            </p>
          </div>

          <div className="marketing-reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-12 [animation-delay:180ms]">
            <ScreenshotCard
              className="sm:col-span-2 lg:col-span-7"
              imageSrc="/assets/marketing/dashboard-clean.png"
              imageAlt="Studio Co-op dashboard overview"
              title="Operations at a glance"
            />
            <ScreenshotCard
              className="sm:col-span-2 lg:col-span-5"
              imageSrc="/assets/marketing/feed-clean.png"
              imageAlt="Private class feed on Studio Co-op"
              title="Private community feed"
            />
            <ScreenshotCard
              className="lg:col-span-5"
              imageSrc="/assets/marketing/schedule-clean.png"
              imageAlt="Studio schedule management on Studio Co-op"
              title="Class schedule control"
            />
            <ScreenshotCard
              className="lg:col-span-7"
              imageSrc="/assets/marketing/members-clean.png"
              imageAlt="Member list and check-in workflow on Studio Co-op"
              title="Member management"
            />
          </div>
        </section>

        <section className="relative border-y border-border/60 bg-card/80">
          <div className="mx-auto w-full max-w-6xl px-6 py-20">
            <div className="mb-14 text-center">
              <h2 className="marketing-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
                Get your studio running on Co-op in under 5 minutes.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {STEPS.map((item, index) => (
                <StepCard key={item.title} step={item.step} title={item.title} description={item.description} delay={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="marketing-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Everything your studio needs
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
              No bloat. No enterprise pricing. Just the tools that actually matter.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={index}
              />
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="grid gap-8 rounded-[2rem] border border-white/75 bg-gradient-to-br from-[#FFF3E8] via-card to-[#EAF6F2] p-8 shadow-[0_24px_80px_-48px_rgba(24,34,53,0.45)] lg:grid-cols-[1.1fr_0.9fr] lg:items-center sm:p-12">
            <article className="marketing-reveal [animation-delay:90ms]">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Empire case study</p>
              <h2 className="marketing-display mt-4 text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
                Emma built Empire for aerial arts and community, not software firefighting
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Emma has run Empire Aerial Arts on Mindbody for 5 years. The platform has been a constant headache:
                too much friction, too many workarounds, and too much time spent managing software instead of members.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Rabble built Studio Co-op after living the same pain from the member side: booking in Mindbody felt
                hard, confusing, and slow. Hearing Emma and the other teachers share the same frustration made it clear
                this was not just a user problem or an owner problem. It was both.
              </p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Empire exists to help people grow through aerial arts and real community. Studio Co-op is being shaped
                around that mission from both ends of the room: simple operations for teachers, fast booking for
                members, and private class spaces that feel personal.
              </p>
              <blockquote className="marketing-display mt-7 max-w-2xl text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl">
                &ldquo;We wanted something that felt like our studio: warm, personal, and community-first.
                Not another generic gym platform.&rdquo;
              </blockquote>
              <p className="mt-6 text-sm uppercase tracking-[0.14em] text-muted-foreground">
                <span className="font-semibold text-foreground">Empire Aerial Arts</span>
                <span className="mx-2">&middot;</span>
                Cuba Street, Wellington NZ
              </p>
            </article>

            <div className="marketing-reveal grid gap-4 [animation-delay:180ms]">
              <div className="overflow-hidden rounded-2xl border border-white/80 bg-card shadow-sm">
                <img
                  src="/empire/pole-technique.jpg"
                  alt="Empire Aerial Arts class in session"
                  className="h-52 w-full object-cover sm:h-64"
                />
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-white/80 bg-card/90 p-4 shadow-sm">
                <img
                  src="/empire/logo.jpg"
                  alt="Empire Aerial Arts logo"
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">Empire Aerial Arts</p>
                  <p className="text-sm text-muted-foreground">Community-first studio in Wellington</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/90">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
            <h2 className="marketing-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Ready to build your community?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Join studios who care more about their people than their software vendor.
              Free to start, no credit card required.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Button asChild size="lg" className="h-12 rounded-full px-8">
                <Link href="/login?mode=signup">Get started - it&apos;s free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-12 rounded-full border-2 px-8">
                <Link href="/demo">See the demo</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
              <span className="text-[10px] font-bold text-white">SC</span>
            </div>
            <span>Studio Co-op</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/legal/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/legal/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <span>Made in Aotearoa</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
  delay,
}: {
  step: string
  title: string
  description: string
  delay: number
}) {
  return (
    <article
      className="marketing-reveal rounded-3xl border border-white/70 bg-background/70 p-6 shadow-sm [animation-delay:130ms]"
      style={{ animationDelay: `${130 + delay * 80}ms` }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
        {step}
      </div>
      <h3 className="marketing-display mt-5 text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: ReactNode
  title: string
  description: string
  delay: number
}) {
  return (
    <article
      className="marketing-reveal group rounded-2xl border border-white/70 bg-card/70 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md [animation-delay:120ms]"
      style={{ animationDelay: `${130 + delay * 60}ms` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {icon}
      </div>
      <h3 className="marketing-display mt-4 text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </article>
  )
}

function ScreenshotCard({
  className,
  imageSrc,
  imageAlt,
  title,
}: {
  className?: string
  imageSrc: string
  imageAlt: string
  title: string
}) {
  return (
    <article className={`rounded-2xl border border-white/80 bg-card p-3 shadow-sm ${className ?? ''}`}>
      <div className="overflow-hidden rounded-xl border border-[#EDE6DD] bg-[#F8F5F1]">
        <img src={imageSrc} alt={imageAlt} className="h-auto w-full" />
      </div>
      <p className="mt-3 px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
    </article>
  )
}

// Simple SVG icons (no extra dependency needed)
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><line x1="12" x2="12.01" y1="18" y2="18" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}
