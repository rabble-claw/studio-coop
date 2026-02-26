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
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm text-muted-foreground mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Built for indie studios
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Your studio, your community, your{' '}
            <span className="text-primary">platform</span>.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">
            Studio Co-op is the management platform that puts community first.
            Schedule classes, manage members, and build a real community around
            your studio — without the corporate overhead.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/login">Start free</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/empire-pole">See a demo studio</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-card border-y">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold mb-12 text-center">Everything your studio needs</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="📅"
              title="Class Scheduling"
              description="Create recurring classes, manage one-offs, set capacity limits. Your schedule, your rules."
            />
            <FeatureCard
              icon="👥"
              title="Member Community"
              description="Post-class feeds, attendance tracking, and member profiles. Build real connections."
            />
            <FeatureCard
              icon="✅"
              title="Check-in Made Easy"
              description="Photo grid check-in for teachers. Tap faces, mark present. Done in 30 seconds."
            />
            <FeatureCard
              icon="📱"
              title="Mobile First"
              description="Members book and engage from their phones. Teachers check in from theirs."
            />
            <FeatureCard
              icon="🔒"
              title="Privacy by Default"
              description="Class feeds are only visible to people who actually showed up. Your community, your space."
            />
            <FeatureCard
              icon="🎯"
              title="Built for Indies"
              description="Pole, BJJ, yoga, CrossFit, dance — built by studio people, for studio people."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to build your community?</h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
          Join studios who care more about their people than their software vendor.
        </p>
        <Button asChild size="lg">
          <Link href="/login">Get started — it&apos;s free</Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>Studio Co-op</span>
          <span>Community-first studio management</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="rounded-xl border bg-background p-6">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  )
}
