import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'
import createNextIntlPlugin from 'next-intl/plugin'

if (process.env.NODE_ENV === 'development') {
  initOpenNextCloudflareForDev()
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  transpilePackages: ['@studio-coop/shared'],
  serverExternalPackages: ['pg'],
  typescript: {
    // Radix UI types are not yet fully compatible with React 19 types.
    // This is a type-only issue that doesn't affect runtime behavior.
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co https://*.sentry.io wss://*.supabase.co",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const config = withNextIntl(nextConfig)

// Only wrap with Sentry if DSN is configured
export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(config, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : config
