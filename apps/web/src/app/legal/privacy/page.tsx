import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Studio Co-op',
  description: 'Privacy Policy for Studio Co-op, the community-first studio management platform.',
}

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studio Co-op (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a studio management platform
              operated from New Zealand. We help independent fitness, dance, aerial, and wellness
              studios manage their classes, members, and payments.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-2">
              This policy explains what personal information we collect, why we collect it, how we
              use it, and what rights you have. We comply with the New Zealand Privacy Act 2020
              and respect the principles of the EU General Data Protection Regulation (GDPR).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>

            <h3 className="text-lg font-medium mt-4 mb-2">Information you provide</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Account information:</strong> Name, email address, and password when you create an account.</li>
              <li><strong>Studio information:</strong> Studio name, address, description, schedule, and pricing (for Studio Owners).</li>
              <li><strong>Booking and membership data:</strong> Class bookings, membership plans, attendance records.</li>
              <li><strong>Payment information:</strong> Payment details are collected and processed by Stripe. We do not store your full card number or bank details.</li>
              <li><strong>Content:</strong> Posts and comments you make in class feeds, profile photos.</li>
              <li><strong>Communications:</strong> Messages you send to us (support requests, feedback).</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Information collected automatically</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Usage data:</strong> Pages visited, features used, and actions taken on the platform.</li>
              <li><strong>Device information:</strong> Browser type, operating system, and device type.</li>
              <li><strong>Log data:</strong> IP address, access times, and referring URLs.</li>
              <li><strong>Error data:</strong> Technical error reports to help us fix issues (collected via Sentry).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">We use your information to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Provide the service:</strong> Run your account, process bookings, manage memberships, and facilitate payments.</li>
              <li><strong>Communicate with you:</strong> Send booking confirmations, schedule changes, and important account notifications.</li>
              <li><strong>Improve the platform:</strong> Understand how people use Studio Co-op so we can make it better.</li>
              <li><strong>Ensure security:</strong> Detect and prevent fraud, abuse, and security issues.</li>
              <li><strong>Comply with law:</strong> Meet our legal obligations, including tax and financial reporting.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              We do not sell your personal information. We do not use your data for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Who We Share Data With</h2>
            <p className="text-muted-foreground leading-relaxed">
              We share your data only with the following service providers who help us run the platform:
            </p>
            <div className="mt-3 border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">Provider</th>
                    <th className="text-left px-4 py-2 font-medium">Purpose</th>
                    <th className="text-left px-4 py-2 font-medium">Data shared</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="px-4 py-2">Supabase</td>
                    <td className="px-4 py-2">Database and authentication</td>
                    <td className="px-4 py-2">Account data, bookings, studio data</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">Stripe</td>
                    <td className="px-4 py-2">Payment processing</td>
                    <td className="px-4 py-2">Name, email, payment details</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">Resend</td>
                    <td className="px-4 py-2">Transactional email</td>
                    <td className="px-4 py-2">Name, email address</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Sentry</td>
                    <td className="px-4 py-2">Error monitoring</td>
                    <td className="px-4 py-2">Error context, device info (anonymised)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Studio Owners can see the information of members who join their studio (name, email,
              booking history, attendance). This is necessary for running the studio. Members can
              see limited information about other members in their studio (name and profile photo
              in class feeds).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using Supabase (hosted on AWS infrastructure). We use
              encryption in transit (TLS) and at rest. Access to production data is restricted and
              logged. We implement row-level security policies to ensure users can only access data
              they are authorised to see.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active. After you close your account:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Your personal profile data is deleted within 30 days.</li>
              <li>Transaction and payment records are retained for 7 years as required for tax and financial reporting.</li>
              <li>Anonymised usage data may be retained indefinitely for analytics.</li>
              <li>Backups containing your data are purged within 90 days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Under the New Zealand Privacy Act 2020 and the GDPR (where applicable), you have
              the right to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Ask us to correct inaccurate or incomplete information.</li>
              <li><strong>Deletion:</strong> Ask us to delete your personal information (subject to legal retention requirements).</li>
              <li><strong>Export:</strong> Request your data in a portable, machine-readable format.</li>
              <li><strong>Objection:</strong> Object to processing of your data in certain circumstances.</li>
              <li><strong>Withdraw consent:</strong> Where processing is based on consent, withdraw that consent at any time.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@studio.coop" className="text-primary hover:underline">privacy@studio.coop</a>.
              We will respond within 20 working days (as required by the NZ Privacy Act).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use essential cookies to keep you logged in and remember your preferences. We do not
              use advertising or tracking cookies. Specifically:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li><strong>Authentication cookies:</strong> Keep you signed in to your account (essential, session-based).</li>
              <li><strong>Preference cookies:</strong> Remember settings like your preferred studio view (essential, persistent).</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Because we only use essential cookies, no cookie consent banner is required. You can
              configure your browser to block cookies, but some features may not work correctly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service providers may process data outside New Zealand (for example, Supabase and
              Stripe operate from the United States). Where data is transferred internationally, we
              ensure appropriate safeguards are in place, including standard contractual clauses and
              the service provider&apos;s own data protection commitments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Studio Co-op is not intended for children under 16. We do not knowingly collect personal
              information from children under 16. If you believe a child under 16 has provided us
              with personal information, please contact us and we will delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by email or through the platform. The &quot;Last updated&quot; date at the top
              of this page indicates when the policy was last revised.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact and Complaints</h2>
            <p className="text-muted-foreground leading-relaxed">
              For privacy questions or to exercise your rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1 mt-2">
              <li>Email: <a href="mailto:privacy@studio.coop" className="text-primary hover:underline">privacy@studio.coop</a></li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              If you are not satisfied with our response, you can lodge a complaint with the{' '}
              <a href="https://privacy.org.nz" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                Office of the Privacy Commissioner
              </a>{' '}
              (New Zealand). If you are in the EU, you may also contact your local data protection authority.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t text-sm text-muted-foreground flex gap-4">
          <Link href="/legal/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        </div>
      </main>
    </div>
  )
}
