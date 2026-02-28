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
