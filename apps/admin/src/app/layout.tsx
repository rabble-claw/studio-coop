import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Studio Co-op Admin',
  description: 'Platform administration for Studio Co-op',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#0a0a0a', color: '#fafafa' }}>
        {children}
      </body>
    </html>
  )
}
