import type { Metadata } from 'next'
import './globals.css'
import AuthGuard from '@/components/auth-guard'

export const metadata: Metadata = {
  title: 'Studio Co-op Admin',
  description: 'Platform administration for Studio Co-op',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
