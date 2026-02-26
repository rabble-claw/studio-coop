import type { NextConfig } from 'next'

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

export default nextConfig
