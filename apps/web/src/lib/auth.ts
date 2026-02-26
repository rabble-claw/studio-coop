import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb, users } from './db'
import { randomUUID } from 'crypto'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'studio-coop-dev-secret-change-in-prod'
)

const COOKIE_NAME = 'session'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

async function createToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ sub: payload.id, email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function signUp(
  email: string,
  password: string,
  name: string
): Promise<SessionUser> {
  const db = getDb()

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email))
  if (existing) throw new Error('Email already in use')

  const passwordHash = await bcrypt.hash(password, 12)
  const [user] = await db
    .insert(users)
    .values({ id: randomUUID(), email, name, passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name })

  const token = await createToken(user)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
  return user
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  const db = getDb()

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))

  if (!user || !user.passwordHash) throw new Error('Invalid credentials')

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Invalid credentials')

  const session: SessionUser = { id: user.id, email: user.email, name: user.name }
  const token = await createToken(session)
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, COOKIE_OPTIONS)
  return session
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      id: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
    }
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
