import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SC</span>
          </div>
          <span className="font-bold text-lg">Studio Co-op</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Log in
          </Link>
          <Button asChild size="sm">
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Built for indie studios
            </div>
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6">
              Your studio,{' '}
              <br className="hidden sm:block" />
              your community,{' '}
              <br className="hidden sm:block" />
              your <span className="text-primary">platform</span>.
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
              Studio Co-op is the management platform that puts community first.
              Schedule classes, check in members with a tap, and build a real
              community around your studio — without the corporate overhead.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="lg" className="text-base px-8 h-12">
                <Link href="/login?mode=signup">Start free</Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="text-base px-8 h-12">
                <Link href="/demo">See the demo</Link>
              </Button>
            </div>
          </div>

          {/* Hero image — studio photo + dashboard screenshot */}
          <div className="relative hidden lg:block min-h-[400px]">
            {/* Studio photo */}
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="/empire/fitness.jpg"
                alt="Studio members forming a heart shape during a class at Empire Aerial Arts"
                className="w-full h-auto object-cover"
              />
            </div>
            {/* Dashboard screenshot overlay */}
            <div className="absolute -bottom-8 -left-12 w-[75%] rounded-xl shadow-2xl border-2 border-white overflow-hidden">
              <img
                src="/assets/Screenshot 2026-02-27 at 2.52.12 PM.png"
                alt="Studio Co-op dashboard showing schedule, community feed, and member stats"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile hero image */}
      <div className="lg:hidden max-w-6xl mx-auto px-6 pb-12">
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <img
            src="/empire/fitness.jpg"
            alt="Studio members forming a heart shape during a class at Empire Aerial Arts"
            className="w-full h-auto object-cover"
          />
        </div>
      </div>

      {/* Social proof bar */}
      <section className="border-y bg-card">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-center">
          <div>
            <div className="text-2xl font-bold">20+</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Active members</div>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-2xl font-bold">10</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Weekly classes</div>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-2xl font-bold">30s</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Check-in time</div>
          </div>
          <div className="w-px h-8 bg-border hidden sm:block" />
          <div>
            <div className="text-2xl font-bold">$0</div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">To get started</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Get your studio running on Co-op in under 5 minutes.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-12">
          <StepCard
            step="1"
            title="Set up your studio"
            description="Add your name, schedule, and invite your teachers. Your public page goes live instantly."
          />
          <StepCard
            step="2"
            title="Members book classes"
            description="Share your link. Members sign up, browse the schedule, and book with a tap from their phone."
          />
          <StepCard
            step="3"
            title="Teach and connect"
            description="Check in students with a photo grid. After class, members share wins in the private class feed."
          />
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything your studio needs</h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              No bloat. No enterprise pricing. Just the tools that actually matter.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<CalendarIcon />}
              title="Class Scheduling"
              description="Recurring templates, one-offs, capacity limits, waitlists. Your schedule, your rules."
            />
            <FeatureCard
              icon={<UsersIcon />}
              title="Member Community"
              description="Post-class feeds visible only to attendees. Real connections, not public performativity."
            />
            <FeatureCard
              icon={<CheckCircleIcon />}
              title="Photo Check-in"
              description="Tap faces to mark present. Teachers check in an entire class in under 30 seconds."
            />
            <FeatureCard
              icon={<PhoneIcon />}
              title="Mobile First"
              description="Members book from their phones. Teachers check in from theirs. No app download required."
            />
            <FeatureCard
              icon={<ShieldIcon />}
              title="Privacy by Default"
              description="Class feeds locked to attendees. Your community stays in your community."
            />
            <FeatureCard
              icon={<SparklesIcon />}
              title="Built for Indies"
              description="Pole, aerial, BJJ, yoga, dance — built by studio people, for studio people."
            />
          </div>
        </div>
      </section>

      {/* Testimonial / use case */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="rounded-2xl bg-secondary/50 border p-8 sm:p-12 text-center max-w-3xl mx-auto">
          <div className="text-4xl mb-6">&#x1F3AA;</div>
          <blockquote className="text-xl sm:text-2xl font-medium leading-relaxed mb-6">
            &ldquo;We wanted something that felt like our studio — warm, personal, community-first.
            Not another generic gym platform.&rdquo;
          </blockquote>
          <div className="text-muted-foreground">
            <span className="font-medium text-foreground">Empire Aerial Arts</span>
            <span className="mx-2">&middot;</span>
            Cuba Street, Wellington NZ
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-card">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to build your community?</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Join studios who care more about their people than their software vendor.
            Free to start, no credit card required.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button asChild size="lg" className="text-base px-8 h-12">
              <Link href="/login?mode=signup">Get started — it&apos;s free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-base px-8 h-12">
              <Link href="/demo">See the demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">SC</span>
            </div>
            <span>Studio Co-op</span>
          </div>
          <span>Community-first studio management. Made in Aotearoa.</span>
        </div>
      </footer>
    </div>
  )
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-background p-6 hover:border-primary/30 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
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
