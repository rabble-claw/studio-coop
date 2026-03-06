import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin, type StudioEnv } from '../middleware/studio-access'
import { badRequest, notFound } from '../lib/errors'
import { createServiceClient } from '../lib/supabase'

type InstagramAuthTokenResponse = {
  access_token: string
  user_id: number
}

type InstagramLongLivedTokenResponse = {
  access_token: string
  token_type?: string
  expires_in?: number
}

type InstagramProfileResponse = {
  id: string
  username?: string
  account_type?: string
  media_count?: number
}

type InstagramMediaNode = {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  username?: string
}

type InstagramMediaResponse = {
  data?: InstagramMediaNode[]
  paging?: { next?: string }
}

const DEFAULT_REDIRECT_PATH = '/dashboard/settings'
const DEFAULT_INSTAGRAM_SCOPES = 'user_profile,user_media'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

const social = new Hono<StudioEnv>()

function firstNonEmpty(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}

function normalizeRedirectPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_REDIRECT_PATH
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return DEFAULT_REDIRECT_PATH
  return trimmed.slice(0, 240)
}

function getInstagramConfig() {
  const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim()
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET?.trim()
  const apiUrl = process.env.API_URL?.trim() || 'https://api.studio.coop'
  const defaultRedirectUri = `${apiUrl.replace(/\/+$/, '')}/api/studios/social/instagram/callback`
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI?.trim() || defaultRedirectUri
  const scopes = process.env.INSTAGRAM_SCOPES?.trim() || DEFAULT_INSTAGRAM_SCOPES

  if (!clientId || !clientSecret) {
    throw new Error('Missing Instagram OAuth configuration')
  }

  return { clientId, clientSecret, redirectUri, scopes }
}

function createStateToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const suffix = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${crypto.randomUUID()}-${suffix}`
}

function buildWebRedirect(redirectPath: string | null | undefined, params: Record<string, string | undefined>) {
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000'
  const url = new URL(normalizeRedirectPath(redirectPath), webUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) url.searchParams.set(key, value)
  }
  return url.toString()
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const body = payload as { error_message?: string; error?: { message?: string } }
    const message = body?.error?.message || body?.error_message || response.statusText
    throw new Error(`Instagram API ${response.status}: ${message}`)
  }

  return payload as T
}

async function exchangeAuthCodeForToken(code: string, config: ReturnType<typeof getInstagramConfig>) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
    code,
  })

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  return parseJsonResponse<InstagramAuthTokenResponse>(response)
}

async function exchangeForLongLivedToken(
  accessToken: string,
  config: ReturnType<typeof getInstagramConfig>
): Promise<InstagramLongLivedTokenResponse | null> {
  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', config.clientSecret)
  url.searchParams.set('access_token', accessToken)

  try {
    const response = await fetch(url.toString())
    return await parseJsonResponse<InstagramLongLivedTokenResponse>(response)
  } catch {
    // If long-lived exchange fails, we can still proceed with short-lived token.
    return null
  }
}

async function fetchInstagramProfile(accessToken: string) {
  const url = new URL('https://graph.instagram.com/me')
  url.searchParams.set('fields', 'id,username,account_type,media_count')
  url.searchParams.set('access_token', accessToken)
  const response = await fetch(url.toString())
  return parseJsonResponse<InstagramProfileResponse>(response)
}

async function fetchInstagramMedia(accessToken: string, limit = 30) {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username'
  const initialUrl = new URL('https://graph.instagram.com/me/media')
  initialUrl.searchParams.set('fields', fields)
  initialUrl.searchParams.set('limit', String(Math.min(limit, 50)))
  initialUrl.searchParams.set('access_token', accessToken)

  const media: InstagramMediaNode[] = []
  let nextUrl: string | null = initialUrl.toString()

  while (nextUrl && media.length < limit) {
    const mediaResponse: Response = await fetch(nextUrl)
    const payload: InstagramMediaResponse = await parseJsonResponse<InstagramMediaResponse>(mediaResponse)
    for (const node of payload.data ?? []) {
      if (!node.id || !node.permalink) continue
      media.push(node)
      if (media.length >= limit) break
    }
    nextUrl = payload.paging?.next ?? null
  }

  return media
}

function extractInstagramHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const reserved = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts'])
  const directHandle = raw.replace(/^@/, '').split(/[/?#]/)[0]?.trim()

  if (
    directHandle
    && !raw.startsWith('http://')
    && !raw.startsWith('https://')
    && !reserved.has(directHandle.toLowerCase())
  ) {
    return directHandle
  }

  try {
    const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`)
    const segment = parsed.pathname.split('/').filter(Boolean)[0]
    if (!segment || reserved.has(segment.toLowerCase())) return null
    return segment
  } catch {
    return null
  }
}

async function upsertTeacherProfilesFromStudioSettings(supabase: ReturnType<typeof createServiceClient>, studioId: string) {
  const { data: studio, error: studioError } = await supabase
    .from('studios')
    .select('settings')
    .eq('id', studioId)
    .single()

  if (studioError || !studio) return

  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const teacherSpotlights = Array.isArray(settings.teacher_spotlights)
    ? settings.teacher_spotlights
    : []

  const payload = teacherSpotlights
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const teacher = entry as Record<string, unknown>
      const teacherName = firstNonEmpty(teacher.name)
      const handle = extractInstagramHandle(teacher.instagram)
      if (!teacherName || !handle) return null
      return {
        studio_id: studioId,
        teacher_name: teacherName,
        provider: 'instagram',
        provider_username: handle,
        profile_url: `https://www.instagram.com/${handle}/`,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((entry): entry is {
      studio_id: string
      teacher_name: string
      provider: 'instagram'
      provider_username: string
      profile_url: string
      updated_at: string
    } => Boolean(entry))

  if (payload.length === 0) return

  await supabase
    .from('studio_teacher_social_profiles')
    .upsert(payload, { onConflict: 'studio_id,provider,provider_username' })
}

async function syncInstagramData(args: {
  studioId: string
  accessToken: string
  tokenExpiresAt: string | null
  scopes: string[]
  createdBy?: string
}) {
  const supabase = createServiceClient()
  const profile = await fetchInstagramProfile(args.accessToken)
  if (!profile.id) {
    throw new Error('Instagram profile ID missing from response')
  }

  const nowIso = new Date().toISOString()
  const { data: account, error: accountError } = await supabase
    .from('studio_social_accounts')
    .upsert({
      studio_id: args.studioId,
      provider: 'instagram',
      provider_account_id: profile.id,
      provider_username: profile.username ?? null,
      access_token: args.accessToken,
      token_expires_at: args.tokenExpiresAt,
      scopes: args.scopes,
      metadata: {
        account_type: profile.account_type ?? null,
        media_count: profile.media_count ?? null,
      },
      status: 'active',
      last_synced_at: nowIso,
      updated_at: nowIso,
      ...(args.createdBy ? { created_by: args.createdBy } : {}),
    }, { onConflict: 'studio_id,provider,provider_account_id' })
    .select('id, provider_account_id, provider_username')
    .single()

  if (accountError || !account) {
    throw new Error(accountError?.message || 'Failed to save Instagram account')
  }

  // Mark previous imported rows from this account inactive before refreshing.
  await supabase
    .from('studio_social_media')
    .update({ is_active: false, updated_at: nowIso })
    .eq('studio_id', args.studioId)
    .eq('provider', 'instagram')
    .eq('social_account_id', account.id)

  const mediaItems = await fetchInstagramMedia(args.accessToken, 30)
  const mediaPayload = mediaItems.map((item) => ({
    studio_id: args.studioId,
    social_account_id: account.id,
    provider: 'instagram' as const,
    provider_media_id: item.id,
    owner_provider_account_id: profile.id,
    owner_display_name: firstNonEmpty(item.username, profile.username),
    caption: firstNonEmpty(item.caption),
    permalink_url: item.permalink!,
    media_type: firstNonEmpty(item.media_type),
    media_url: firstNonEmpty(item.media_url),
    thumbnail_url: firstNonEmpty(item.thumbnail_url),
    published_at: firstNonEmpty(item.timestamp),
    is_active: true,
    raw_payload: item,
    updated_at: nowIso,
  }))

  if (mediaPayload.length > 0) {
    const { error: mediaError } = await supabase
      .from('studio_social_media')
      .upsert(mediaPayload, { onConflict: 'provider,provider_media_id' })

    if (mediaError) {
      throw new Error(mediaError.message)
    }
  }

  // Backfill top-level studio Instagram URL if it isn't configured yet.
  if (profile.username) {
    const { data: studio } = await supabase
      .from('studios')
      .select('settings')
      .eq('id', args.studioId)
      .single()

    if (studio) {
      const settings = (studio.settings ?? {}) as Record<string, unknown>
      const existingInstagram = typeof settings.instagram === 'string' ? settings.instagram.trim() : ''
      if (!existingInstagram) {
        const newSettings = { ...settings, instagram: `https://www.instagram.com/${profile.username}/` }
        await supabase
          .from('studios')
          .update({ settings: newSettings })
          .eq('id', args.studioId)
      }
    }
  }

  await upsertTeacherProfilesFromStudioSettings(supabase, args.studioId)

  return {
    accountId: account.id as string,
    username: profile.username ?? null,
    syncedCount: mediaPayload.length,
    lastSyncedAt: nowIso,
  }
}

social.get('/:studioId/social/instagram', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: account } = await supabase
    .from('studio_social_accounts')
    .select('id, provider_username, status, token_expires_at, last_synced_at, created_at, updated_at')
    .eq('studio_id', studioId)
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { count: mediaCount } = await supabase
    .from('studio_social_media')
    .select('*', { count: 'exact', head: true })
    .eq('studio_id', studioId)
    .eq('provider', 'instagram')
    .eq('is_active', true)

  return c.json({
    connected: Boolean(account),
    configReady: Boolean(
      process.env.INSTAGRAM_CLIENT_ID
      && process.env.INSTAGRAM_CLIENT_SECRET
    ),
    mediaCount: mediaCount ?? 0,
    account: account ?? null,
  })
})

social.post('/:studioId/social/instagram/connect', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId')
  const user = c.get('user')
  const config = getInstagramConfig()
  const supabase = createServiceClient()
  const body = await c.req.json().catch(() => ({})) as { redirectPath?: string }

  const stateToken = createStateToken()
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString()
  const redirectPath = normalizeRedirectPath(body.redirectPath)

  await supabase
    .from('studio_social_oauth_states')
    .delete()
    .eq('provider', 'instagram')
    .lt('expires_at', new Date().toISOString())

  const { error } = await supabase
    .from('studio_social_oauth_states')
    .insert({
      studio_id: studioId,
      user_id: user.id,
      provider: 'instagram',
      state_token: stateToken,
      redirect_path: redirectPath,
      expires_at: expiresAt,
    })

  if (error) {
    throw new Error(error.message)
  }

  const authorizeUrl = new URL('https://api.instagram.com/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', config.clientId)
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri)
  authorizeUrl.searchParams.set('scope', config.scopes)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('state', stateToken)

  return c.json({
    authorizeUrl: authorizeUrl.toString(),
    expiresAt,
    redirectPath,
  })
})

social.get('/social/instagram/callback', async (c) => {
  const stateToken = c.req.query('state')
  const oauthError = c.req.query('error')
  const code = c.req.query('code')

  if (!stateToken) {
    return c.redirect(buildWebRedirect(DEFAULT_REDIRECT_PATH, {
      social: 'instagram',
      status: 'error',
      reason: 'missing_state',
    }))
  }

  const supabase = createServiceClient()
  const { data: oauthState } = await supabase
    .from('studio_social_oauth_states')
    .select('id, studio_id, user_id, redirect_path, expires_at')
    .eq('provider', 'instagram')
    .eq('state_token', stateToken)
    .maybeSingle()

  if (!oauthState) {
    return c.redirect(buildWebRedirect(DEFAULT_REDIRECT_PATH, {
      social: 'instagram',
      status: 'error',
      reason: 'state_not_found',
    }))
  }

  const redirectPath = normalizeRedirectPath(oauthState.redirect_path)
  const isExpired = new Date(oauthState.expires_at).getTime() < Date.now()
  if (isExpired) {
    await supabase.from('studio_social_oauth_states').delete().eq('id', oauthState.id)
    return c.redirect(buildWebRedirect(redirectPath, {
      social: 'instagram',
      status: 'error',
      reason: 'state_expired',
    }))
  }

  try {
    if (oauthError) {
      return c.redirect(buildWebRedirect(redirectPath, {
        social: 'instagram',
        status: 'error',
        reason: 'access_denied',
      }))
    }

    if (!code) {
      throw badRequest('Instagram callback missing code')
    }

    const config = getInstagramConfig()
    const shortLived = await exchangeAuthCodeForToken(code, config)
    const longLived = await exchangeForLongLivedToken(shortLived.access_token, config)

    const accessToken = longLived?.access_token || shortLived.access_token
    const tokenExpiresAt = typeof longLived?.expires_in === 'number'
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null

    const syncResult = await syncInstagramData({
      studioId: oauthState.studio_id as string,
      accessToken,
      tokenExpiresAt,
      scopes: config.scopes.split(',').map((scope) => scope.trim()).filter(Boolean),
      createdBy: oauthState.user_id as string | undefined,
    })

    return c.redirect(buildWebRedirect(redirectPath, {
      social: 'instagram',
      status: 'connected',
      synced: String(syncResult.syncedCount),
      username: syncResult.username ?? undefined,
    }))
  } catch (error) {
    console.error('Instagram callback failed:', error)
    return c.redirect(buildWebRedirect(redirectPath, {
      social: 'instagram',
      status: 'error',
      reason: 'sync_failed',
    }))
  } finally {
    await supabase.from('studio_social_oauth_states').delete().eq('id', oauthState.id)
  }
})

social.post('/:studioId/social/instagram/sync', authMiddleware, requireAdmin, async (c) => {
  const studioId = c.get('studioId')
  const supabase = createServiceClient()

  const { data: account } = await supabase
    .from('studio_social_accounts')
    .select('id, access_token, token_expires_at, scopes')
    .eq('studio_id', studioId)
    .eq('provider', 'instagram')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!account) throw notFound('Instagram connection')

  if (!account.access_token) {
    throw badRequest('Instagram access token is missing; reconnect Instagram.')
  }

  if (account.token_expires_at && new Date(account.token_expires_at).getTime() < Date.now()) {
    await supabase
      .from('studio_social_accounts')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', account.id)
    throw badRequest('Instagram token has expired. Reconnect Instagram to continue syncing.')
  }

  const syncResult = await syncInstagramData({
    studioId,
    accessToken: account.access_token as string,
    tokenExpiresAt: account.token_expires_at as string | null,
    scopes: Array.isArray(account.scopes) ? account.scopes : [],
  })

  return c.json({
    synced: syncResult.syncedCount,
    username: syncResult.username,
    lastSyncedAt: syncResult.lastSyncedAt,
  })
})

export default social
