import { jwtVerify } from 'jose'
import { NextResponse, type NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'studio-coop-dev-secret-change-in-prod'
)

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  let authenticated = false
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET)
      authenticated = true
    } catch {
      // Expired or invalid token — treat as unauthenticated
    }
  }

  // Redirect unauthenticated users away from dashboard
  if (!authenticated && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login
  if (authenticated && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
