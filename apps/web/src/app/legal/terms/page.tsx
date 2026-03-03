import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Studio Co-op',
  description: 'Terms of Service for Studio Co-op, the community-first studio management platform.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SC</span>
          </div>
          <span className="font-bold text-lg">Studio Co-op</span>
        </Link>
        <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Log in
        </Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. About Studio Co-op</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studio Co-op (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a software-as-a-service platform
              that helps independent fitness, dance, aerial, and wellness studios manage their classes,
              members, and payments. Studio Co-op is operated from New Zealand.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              By creating an account or using Studio Co-op, you agree to these Terms of Service.
              If you do not agree, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must provide accurate information when creating an account. You are responsible for
              keeping your login credentials secure and for all activity under your account. You must
              be at least 16 years old to create an account.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              We may suspend or terminate accounts that violate these terms, are inactive for an
              extended period, or are used for fraudulent purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Studio Owners</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you create a studio on the platform, you are a &quot;Studio Owner.&quot; As a Studio Owner, you:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Are responsible for the accuracy of your studio&apos;s information, class schedules, and pricing.</li>
              <li>Must comply with all applicable laws in your jurisdiction, including consumer protection, health and safety, and tax obligations.</li>
              <li>Are responsible for your relationship with your members, including handling disputes, refunds, and cancellations.</li>
              <li>Grant Studio Co-op permission to display your studio&apos;s public information (name, schedule, description) on the platform.</li>
              <li>Must have the right to offer the classes and services listed on your studio page.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Members</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you join a studio as a member, you agree to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Follow the studio&apos;s rules and policies.</li>
              <li>Provide accurate information when booking classes or purchasing memberships.</li>
              <li>Respect the privacy of other members and not share content from private class feeds outside the community.</li>
              <li>Honour your booking commitments and follow the studio&apos;s cancellation policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Payments</h2>
            <p className="text-muted-foreground leading-relaxed">
              Payments on Studio Co-op are processed through Stripe Connect. When you make a payment:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>You are paying the Studio Owner directly. Studio Co-op is not a party to the transaction between you and the studio.</li>
              <li>Studio Co-op charges a 2.5% platform fee on transactions processed through the platform. This fee is deducted before funds reach the Studio Owner.</li>
              <li>Standard Stripe processing fees also apply and are set by Stripe.</li>
              <li>Refunds are handled by the Studio Owner according to their own refund policy. Studio Co-op does not issue refunds on behalf of studios.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Studio Owners are responsible for setting up and maintaining their Stripe Connect account
              and for complying with Stripe&apos;s terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Subscriptions and Cancellation</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studios may offer recurring membership plans. When you subscribe to a plan:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>You authorise recurring charges at the frequency specified (weekly, fortnightly, or monthly).</li>
              <li>You can cancel your subscription at any time through your account settings. Cancellation takes effect at the end of your current billing period.</li>
              <li>The studio&apos;s cancellation and refund policies apply to any unused portion of your subscription.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Use the platform for any unlawful purpose.</li>
              <li>Harass, abuse, or threaten other users.</li>
              <li>Upload harmful content, malware, or spam.</li>
              <li>Attempt to gain unauthorised access to other accounts or platform systems.</li>
              <li>Scrape, copy, or redistribute platform content without permission.</li>
              <li>Misrepresent your identity or affiliation with a studio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studio Co-op owns the platform software, design, and branding. Studio Owners retain
              ownership of their content (class descriptions, images, studio information). Members
              retain ownership of any content they post (such as class feed posts).
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              By posting content on the platform, you grant Studio Co-op a licence to display and
              distribute that content as part of the normal operation of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Data and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We take your privacy seriously. Our{' '}
              <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>{' '}
              describes what data we collect, how we use it, and your rights. By using Studio Co-op,
              you agree to our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Availability and Changes</h2>
            <p className="text-muted-foreground leading-relaxed">
              We aim to keep Studio Co-op available and reliable, but we do not guarantee uninterrupted
              service. We may update, modify, or discontinue features at any time. We will give
              reasonable notice of significant changes that affect your use of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studio Co-op is provided &quot;as is&quot; without warranties of any kind, express or implied.
              To the maximum extent permitted by New Zealand law:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.</li>
              <li>Our total liability to you for any claim is limited to the amount you have paid to Studio Co-op (not to studios) in the 12 months preceding the claim.</li>
              <li>We are not responsible for the actions, content, or policies of Studio Owners or other users.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Nothing in these terms excludes or limits liability that cannot be excluded under
              New Zealand law, including under the Consumer Guarantees Act 1993.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can close your account at any time by contacting us. Studio Owners can close their
              studio, which will cancel all active memberships and subscriptions. We may terminate or
              suspend your account if you violate these terms.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              On termination, your right to use the platform ends. We will retain your data in
              accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms are governed by the laws of New Zealand. Any disputes will be resolved
              in the courts of New Zealand. If any part of these terms is found to be unenforceable,
              the remaining terms continue in effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Changes to These Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these terms from time to time. We will notify you of material changes
              by email or through the platform. Continued use of Studio Co-op after changes take
              effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these terms, contact us at{' '}
              <a href="mailto:hello@studio.coop" className="text-primary hover:underline">hello@studio.coop</a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t text-sm text-muted-foreground flex gap-4">
          <Link href="/legal/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        </div>
      </main>
    </div>
  )
}
