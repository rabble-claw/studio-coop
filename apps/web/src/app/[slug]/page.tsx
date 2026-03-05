import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { formatTime, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { CouponInput } from '@/components/coupon-input'

type MembershipPlan = {
  id: string
  name: string
  description?: string | null
  type: string
  price_cents: number
  currency: string
  interval: string
  class_limit?: number | null
  validity_days?: number | null
  active: boolean
  sort_order: number
}

type PublicClassForDisplay = {
  id: string
  date: string
  start_time: string
  end_time: string
  max_capacity?: number | null
  booked_count?: number | null
  teacher?: { name?: string | null } | null
  template?: { name?: string | null; description?: string | null } | null
}

type EmpireWeeklyClassTemplate = {
  weekday: number
  name: string
  teacher: string
  start_time: string
  end_time: string
}

function formatPlanPrice(plan: MembershipPlan): string {
  const amount = (plan.price_cents / 100).toFixed(2).replace(/\.00$/, '')
  const currency = plan.currency.toUpperCase()
  const symbol = currency === 'NZD' ? 'NZ$' : currency === 'AUD' ? 'A$' : '$'
  return `${symbol}${amount}`
}

function formatPlanInterval(plan: MembershipPlan): string {
  if (plan.interval === 'month') return '/ month'
  if (plan.interval === 'year') return '/ year'
  return ''
}

function firstNonEmptyString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value
  }
  return null
}

function normalizePersonKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function toTeacherSlug(value: string) {
  return normalizePersonKey(value).replace(/\s+/g, '-')
}

function isEmpireStudio(studio: { name: string; slug: string }) {
  return studio.name.toLowerCase().includes('empire aerial arts') || studio.slug.toLowerCase().includes('empire')
}

function getStudioLogoUrl(studio: { name: string; slug: string; logo_url?: string | null }, settings: Record<string, unknown>) {
  const configuredLogo = firstNonEmptyString(studio.logo_url, settings.logo_url)
  if (configuredLogo) return configuredLogo
  if (isEmpireStudio(studio)) return '/empire/logo.jpg'
  return null
}

function getStudioHeroImageUrl(studio: { name: string; slug: string }, settings: Record<string, unknown>) {
  const configuredImage = firstNonEmptyString(
    settings.cover_image_url,
    settings.hero_image_url,
    settings.photo_url,
    settings.image_url,
    settings.banner_url,
    settings.studio_photo_url
  )
  if (configuredImage) return configuredImage
  if (isEmpireStudio(studio)) return '/empire/hero.jpg'
  return '/assets/studio-photo.png'
}

function getWelcomePointers(discipline: string) {
  const value = discipline.toLowerCase()

  if (value === 'aerial' || value === 'pole' || value === 'dance') {
    return [
      'Beginner-friendly classes every week',
      'No previous experience required',
      'Teachers coach you from your first minute',
    ]
  }

  if (value === 'yoga' || value === 'pilates') {
    return [
      'Start at your own pace with supportive instruction',
      'Modifications offered for all levels',
      'You can join even if it is your first class',
    ]
  }

  return [
    'Friendly first-timer experience',
    'Clear coaching and guidance from day one',
    'A community that welcomes new members',
  ]
}

function normalizeSocialUrl(value: string | undefined, platform: 'instagram' | 'tiktok' | 'facebook' | 'youtube') {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw

  const handle = raw.replace(/^@/, '')

  if (platform === 'instagram') return `https://instagram.com/${handle}`
  if (platform === 'tiktok') return `https://www.tiktok.com/@${handle}`
  if (platform === 'facebook') return `https://facebook.com/${handle}`
  return `https://youtube.com/@${handle}`
}

function normalizeWebsiteUrl(value: string | undefined) {
  if (!value) return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://${raw}`
}

function getInstagramHandle(value: string | undefined) {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  const reservedInstagramPaths = new Set(['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'accounts'])

  const fromHandle = raw.replace(/^@/, '').split(/[/?#]/)[0]?.trim()
  if (
    fromHandle
    && !raw.startsWith('http://')
    && !raw.startsWith('https://')
    && !reservedInstagramPaths.has(fromHandle.toLowerCase())
  ) {
    return fromHandle
  }

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`
    const parsed = new URL(url)
    const segment = parsed.pathname.split('/').filter(Boolean)[0]
    if (!segment) return null
    if (reservedInstagramPaths.has(segment.toLowerCase())) return null
    return segment.trim()
  } catch {
    return fromHandle && !reservedInstagramPaths.has(fromHandle.toLowerCase()) ? fromHandle : null
  }
}

const LOCAL_INSTAGRAM_AVATARS: Record<string, string> = {
  'emma.louise.nz': '/empire/instructors/emma.louise.nz.jpg',
  'floraofthecosmos': '/empire/instructors/floraofthecosmos.jpg',
  'katie.leticia': '/empire/instructors/katie.leticia.jpg',
  'amy_acrobatics': '/empire/instructors/amy_acrobatics.jpg',
  'daniela_captain_dee': '/empire/instructors/daniela_captain_dee.jpg',
  'atomic_tangerine.pole': '/empire/instructors/atomic_tangerine.pole.jpg',
  'trystn_oliver_town': '/empire/instructors/trystn_oliver_town.jpg',
  'femmefatale.pd': '/empire/instructors/femmefatale.pd.jpg',
}

function getLocalInstagramAvatarUrl(value: string | undefined) {
  const handle = getInstagramHandle(value)?.toLowerCase()
  if (!handle) return null
  return LOCAL_INSTAGRAM_AVATARS[handle] ?? null
}

function getTeacherInstagramUrl(socials: Array<{ label: string; url: string }>) {
  return socials.find((social) => social.label === 'Instagram')?.url
}

const EMPIRE_MINDBODY_WEEKLY_CLASSES: EmpireWeeklyClassTemplate[] = [
  { weekday: 6, name: 'Pole Level 1 & 2', teacher: 'Emma Louise', start_time: '10:00', end_time: '11:00' },
  { weekday: 6, name: 'Lyra Technique Level 2', teacher: 'V .', start_time: '10:00', end_time: '11:00' },
  { weekday: 6, name: 'Lyra Technique Level 1', teacher: 'Emma Louise', start_time: '11:10', end_time: '12:10' },
  { weekday: 6, name: 'Strong & Flippy Pole L3+', teacher: 'V .', start_time: '11:10', end_time: '12:10' },
  { weekday: 0, name: 'Open Pole Training', teacher: 'Emma Louise', start_time: '10:00', end_time: '11:30' },
  { weekday: 0, name: 'Mobility Bootcamp!', teacher: 'Emma Louise', start_time: '10:00', end_time: '11:30' },
  { weekday: 1, name: 'Splits Blitz!', teacher: 'Laura Oakley', start_time: '17:25', end_time: '18:25' },
  { weekday: 1, name: 'Pole Level 3', teacher: 'James .', start_time: '18:35', end_time: '19:35' },
  { weekday: 1, name: 'Pole Level 5 Social', teacher: 'Emma Louise', start_time: '19:45', end_time: '20:45' },
  { weekday: 2, name: 'Pole Level 4', teacher: 'Andie .', start_time: '17:25', end_time: '18:25' },
  { weekday: 2, name: 'Atomic Combos', teacher: 'Andie .', start_time: '18:35', end_time: '19:35' },
  { weekday: 2, name: 'Unwind & Release', teacher: 'James .', start_time: '19:45', end_time: '20:45' },
  { weekday: 3, name: 'Grounded Aerials', teacher: 'Emma Louise', start_time: '17:25', end_time: '18:25' },
  { weekday: 3, name: 'Pole Level 1', teacher: 'Amy Grace Laura .', start_time: '18:35', end_time: '19:35' },
  { weekday: 3, name: 'Booty!', teacher: 'Emma Louise', start_time: '18:35', end_time: '19:35' },
  { weekday: 3, name: 'Pole Level 2', teacher: 'Amy Grace Laura .', start_time: '19:45', end_time: '20:45' },
  { weekday: 4, name: 'Progressions Pole (L2+)', teacher: 'Emma Louise', start_time: '17:25', end_time: '18:25' },
  { weekday: 4, name: 'Open Lyra Training', teacher: 'Emma Louise', start_time: '17:25', end_time: '18:25' },
  { weekday: 4, name: 'Aerial Development', teacher: 'Emma Louise', start_time: '18:35', end_time: '19:35' },
  { weekday: 4, name: 'Pole Level 2', teacher: 'Katie Leticia', start_time: '18:35', end_time: '19:35' },
  { weekday: 4, name: 'Pole Level 1', teacher: 'Katie Leticia', start_time: '19:45', end_time: '20:45' },
]

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildEmpireMindbodyImportedClasses(baseDate = new Date()) {
  const startOfToday = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  const nowMinutes = baseDate.getHours() * 60 + baseDate.getMinutes()

  return EMPIRE_MINDBODY_WEEKLY_CLASSES
    .map((entry, index) => {
      const [hours, minutes] = entry.start_time.split(':').map((value) => Number(value))
      const classStartMinutes = (hours ?? 0) * 60 + (minutes ?? 0)
      let daysAhead = (entry.weekday - startOfToday.getDay() + 7) % 7
      if (daysAhead === 0 && classStartMinutes <= nowMinutes) daysAhead = 7

      const date = new Date(startOfToday)
      date.setDate(startOfToday.getDate() + daysAhead)
      return {
        id: `empire-mindbody-${formatLocalDate(date)}-${entry.start_time}-${entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
        date: formatLocalDate(date),
        start_time: entry.start_time,
        end_time: entry.end_time,
        max_capacity: null,
        booked_count: null,
        teacher: { name: entry.teacher },
        template: { name: entry.name, description: null },
      } satisfies PublicClassForDisplay
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
}

function classDisplayKey(cls: Pick<PublicClassForDisplay, 'date' | 'start_time' | 'teacher' | 'template'>) {
  const teacher = cls.teacher?.name?.toLowerCase().trim() ?? ''
  const template = cls.template?.name?.toLowerCase().trim() ?? ''
  return `${cls.date}|${cls.start_time}|${teacher}|${template}`
}

function mergeDisplayClasses(primary: PublicClassForDisplay[], fallback: PublicClassForDisplay[]) {
  const merged = new Map<string, PublicClassForDisplay>()
  for (const cls of primary) {
    merged.set(classDisplayKey(cls), cls)
  }
  for (const cls of fallback) {
    if (!merged.has(classDisplayKey(cls))) {
      merged.set(classDisplayKey(cls), cls)
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    .slice(0, 30)
}

type TeacherPublicProfile = {
  name: string
  role: string
  bio: string
  photo_url: string
  instagram: string
  tiktok: string
  facebook: string
  youtube: string
  media_urls: string[]
}

type TeacherSpotlight = {
  name: string
  classCount: number
  nextClassLabel: string
  bio: string
  role: string
  photoUrl: string
  socials: Array<{ label: string; url: string }>
  mediaUrls: string[]
}

function getTeacherSpotlightsFromSettings(settings: Record<string, unknown>) {
  const raw = settings.teacher_spotlights
  if (!Array.isArray(raw)) return [] as TeacherPublicProfile[]

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const value = entry as Record<string, unknown>
      const name = firstNonEmptyString(value.name)
      if (!name) return null

      return {
        name,
        role: firstNonEmptyString(value.role) ?? '',
        bio: firstNonEmptyString(value.bio) ?? '',
        photo_url: firstNonEmptyString(value.photo_url) ?? '',
        instagram: firstNonEmptyString(value.instagram) ?? '',
        tiktok: firstNonEmptyString(value.tiktok) ?? '',
        facebook: firstNonEmptyString(value.facebook) ?? '',
        youtube: firstNonEmptyString(value.youtube) ?? '',
        media_urls: Array.isArray(value.media_urls)
          ? value.media_urls
            .map((url) => firstNonEmptyString(url))
            .filter((url): url is string => Boolean(url))
          : [],
      } satisfies TeacherPublicProfile
    })
    .filter((profile): profile is TeacherPublicProfile => Boolean(profile))
}

function getMediaUrlsFromSettings(settings: Record<string, unknown>) {
  if (!Array.isArray(settings.social_gallery)) return [] as string[]
  return settings.social_gallery
    .map((url) => firstNonEmptyString(url))
    .filter((url): url is string => Boolean(url))
}

function getMediaType(url: string) {
  const lower = url.toLowerCase()
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/.test(lower)) return 'image' as const
  if (/\.(mp4|webm|mov)(\?|$)/.test(lower)) return 'video' as const
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube' as const
  if (lower.includes('instagram.com')) return 'instagram' as const
  if (lower.includes('tiktok.com')) return 'tiktok' as const
  return 'link' as const
}

function getSocialPlatformLabel(type: ReturnType<typeof getMediaType>) {
  if (type === 'instagram') return 'Instagram'
  if (type === 'tiktok') return 'TikTok'
  if (type === 'youtube') return 'YouTube'
  if (type === 'video') return 'Video'
  if (type === 'image') return 'Photo'
  return 'Link'
}

function getMediaHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'external'
  }
}

function getSocialEmbedUrl(url: string, type: ReturnType<typeof getMediaType>) {
  try {
    const parsed = new URL(url)

    if (type === 'youtube') {
      let videoId = parsed.searchParams.get('v') ?? ''
      if (!videoId && parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
      }
      if (!videoId) {
        const parts = parsed.pathname.split('/').filter(Boolean)
        if (parts[0] === 'shorts' || parts[0] === 'embed') {
          videoId = parts[1] ?? ''
        }
      }
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }

    if (type === 'instagram') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const contentType = parts[0]?.toLowerCase()
      const contentId = parts[1]
      if (!contentType || !contentId) return null
      if (contentType !== 'p' && contentType !== 'reel' && contentType !== 'reels' && contentType !== 'tv') return null
      const normalizedType = contentType === 'reels' ? 'reel' : contentType
      return `https://www.instagram.com/${normalizedType}/${contentId}/embed`
    }

    if (type === 'tiktok') {
      const match = parsed.pathname.match(/\/video\/(\d+)/)
      if (!match) return null
      return `https://www.tiktok.com/embed/v2/${match[1]}`
    }

    return null
  } catch {
    return null
  }
}

function getMediaTitle(url: string, type: ReturnType<typeof getMediaType>) {
  if (type === 'instagram') return 'Instagram post'
  if (type === 'tiktok') return 'TikTok post'
  if (type === 'youtube') return 'YouTube video'

  try {
    const parsed = new URL(url)
    const segment = parsed.pathname.split('/').filter(Boolean).pop()
    if (!segment) return 'Open post'
    return decodeURIComponent(segment).replace(/[-_]+/g, ' ').slice(0, 64)
  } catch {
    return 'Open post'
  }
}

function getEmpireTeacherFallbacks(studio: { name: string; slug: string }) {
  if (!isEmpireStudio(studio)) return [] as TeacherPublicProfile[]

  return [
    {
      name: 'Emma Louise',
      role: 'Founder & Lead Coach',
      bio: 'Emma opened Empire to build a real aerial community in Wellington. Her focus is helping first-timers feel welcome, supported, and confident from class one.',
      photo_url: '/empire/pole-technique.jpg',
      instagram: 'https://www.instagram.com/emma.louise.nz/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: [
        'https://www.instagram.com/p/C7zyQ5rS2gj/',
        'https://www.instagram.com/p/C7zyd-Sy09j/',
        'https://www.instagram.com/p/C7zyzOhyczj/',
        'https://www.instagram.com/p/DVW2LO6Ew5q/',
        'https://www.instagram.com/p/DUy7BWtk7V4/',
      ],
    },
    {
      name: 'Fleur .',
      role: 'Pole & Dance Coach',
      bio: 'Fleur coaches expressive movement and supportive progression classes.',
      photo_url: '',
      instagram: 'https://www.instagram.com/floraofthecosmos/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: ['https://www.instagram.com/floraofthecosmos/'],
    },
    {
      name: 'Katie Leticia',
      role: 'Pole Coach',
      bio: 'Katie guides members through strong technical foundations and steady progression.',
      photo_url: '',
      instagram: 'https://www.instagram.com/katie.leticia/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: ['https://www.instagram.com/katie.leticia/'],
    },
    {
      name: 'Amy Grace Laura .',
      role: 'Pole Coach',
      bio: 'Amy teaches focused classes that help members build confidence and consistency.',
      photo_url: '',
      instagram: 'https://www.instagram.com/amy_acrobatics/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: [
        'https://www.instagram.com/reel/DQAP-Yfk4UdiZJVyiz22RmjToSEAHoDNQQP4Eo0/',
        'https://www.instagram.com/p/DTWxb8bkVJDqT2wQuzUMoqEg2DgeXW57OaDK7E0/',
      ],
    },
    {
      name: 'Daniela Leccisi',
      role: 'Pole Coach',
      bio: 'Daniela supports members with clear, practical coaching and strong class energy.',
      photo_url: '',
      instagram: 'https://www.instagram.com/daniela_captain_dee/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: ['https://www.instagram.com/daniela_captain_dee/'],
    },
    {
      // Inferred from handle provided; adjust in studio settings if needed.
      name: 'Andie .',
      role: 'Pole Coach',
      bio: 'Andie runs high-energy pole sessions with athletic combos and progression drills.',
      photo_url: '',
      instagram: 'https://www.instagram.com/atomic_tangerine.pole/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: ['https://www.instagram.com/atomic_tangerine.pole/'],
    },
    {
      // Inferred from handle provided; adjust in studio settings if needed.
      name: 'James .',
      role: 'Coach',
      bio: 'James teaches accessible strength and movement classes for mixed experience levels.',
      photo_url: '',
      instagram: 'https://www.instagram.com/trystn_oliver_town/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: [
        'https://www.instagram.com/reel/DUzvDTWkh38/',
        'https://www.instagram.com/reel/DTtXzV4E3If/',
        'https://www.instagram.com/p/DRWCfkuE5nJ/',
      ],
    },
    {
      // Inferred from handle provided; adjust in studio settings if needed.
      name: 'V .',
      role: 'Aerial & Pole Coach',
      bio: 'V coaches technical aerial and pole classes with an emphasis on safe progression.',
      photo_url: '',
      instagram: 'https://www.instagram.com/femmefatale.pd/',
      tiktok: '',
      facebook: '',
      youtube: '',
      media_urls: ['https://www.instagram.com/femmefatale.pd/'],
    },
  ]
}

async function getStudioData(slug: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: studio } = await supabase.from('studios').select('*').eq('slug', slug).single()
  if (!studio) return null

  const today = new Date().toISOString().split('T')[0]
  const { data: classes } = await supabase
    .from('class_instances')
    .select('*, teacher:users!class_instances_teacher_id_fkey(name), template:class_templates!class_instances_template_id_fkey(name, description)')
    .eq('studio_id', studio.id)
    .eq('status', 'scheduled')
    .gte('date', today)
    .order('date')
    .order('start_time')
    .limit(20)

  const { data: plans } = await supabase
    .from('membership_plans')
    .select('*')
    .eq('studio_id', studio.id)
    .eq('active', true)
    .order('sort_order')

  const dbClasses = ((classes ?? []) as PublicClassForDisplay[])
  const classesForDisplay = isEmpireStudio(studio)
    ? mergeDisplayClasses(dbClasses, buildEmpireMindbodyImportedClasses())
    : dbClasses

  const classesByDate = classesForDisplay.reduce<Record<string, PublicClassForDisplay[]>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  return {
    studio,
    classesByDate,
    plans: (plans ?? []) as MembershipPlan[],
  }
}

const RESERVED_SLUGS = ['api', 'login', 'dashboard', 'demo', 'admin', 'signup', 'forgot-password', 'explore']

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  if (RESERVED_SLUGS.includes(slug)) return {}
  const data = await getStudioData(slug)
  if (!data) return {}
  const { studio } = data
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const address = settings.address as string | undefined
  const description = studio.description ?? `${studio.name} — ${studio.discipline} studio${address ? ` in ${address}` : ''}. View schedule and pricing on Studio Co-op.`
  return {
    title: `${studio.name} | Studio Co-op`,
    description,
    openGraph: {
      title: studio.name,
      description,
      type: 'website',
      ...(studio.logo_url ? { images: [{ url: studio.logo_url }] } : {}),
    },
  }
}

export default async function PublicStudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (RESERVED_SLUGS.includes(slug)) notFound()
  const data = await getStudioData(slug)
  if (!data) notFound()
  const { studio, classesByDate, plans } = data
  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const address = settings.address as string | undefined
  const studioEmail = settings.email as string | undefined
  const instagram = settings.instagram as string | undefined
  const facebook = settings.facebook as string | undefined
  const tiktok = settings.tiktok as string | undefined
  const youtube = settings.youtube as string | undefined
  const studioPhone = settings.phone as string | undefined
  const website = settings.website as string | undefined
  const scheduleSubtitle = settings.schedule_subtitle as string | undefined
  const logoUrl = getStudioLogoUrl({ name: studio.name, slug: studio.slug, logo_url: studio.logo_url }, settings)
  const heroImageUrl = getStudioHeroImageUrl({ name: studio.name, slug: studio.slug }, settings)
  const welcomePointers = getWelcomePointers(studio.discipline)
  const upcomingClassCount = Object.values(classesByDate).reduce((total, dayClasses) => total + (dayClasses?.length ?? 0), 0)
  const empireFallbackInstagram = isEmpireStudio(studio) ? 'https://www.instagram.com/empireaerialarts/' : undefined
  const empireFallbackWebsite = isEmpireStudio(studio) ? 'https://linktr.ee/Emma_Lou_Empire' : undefined
  const instagramUrl = normalizeSocialUrl(instagram, 'instagram') ?? empireFallbackInstagram
  const tiktokUrl = normalizeSocialUrl(tiktok, 'tiktok')
  const facebookUrl = normalizeSocialUrl(facebook, 'facebook')
  const youtubeUrl = normalizeSocialUrl(youtube, 'youtube')
  const websiteUrl = normalizeWebsiteUrl(website)
    ?? empireFallbackWebsite

  const configuredTeacherProfiles = getTeacherSpotlightsFromSettings(settings)
  const teacherProfiles = configuredTeacherProfiles.length > 0
    ? configuredTeacherProfiles
    : getEmpireTeacherFallbacks(studio)
  const configuredTeacherByName = new Map<string, TeacherPublicProfile>()
  for (const teacher of teacherProfiles) {
    const exactKey = teacher.name.toLowerCase()
    const normalizedKey = normalizePersonKey(teacher.name)
    configuredTeacherByName.set(exactKey, teacher)
    configuredTeacherByName.set(normalizedKey, teacher)
  }

  const socialLinks = [
    { label: 'Instagram', url: instagramUrl, blurb: 'Class clips and studio highlights' },
    { label: 'TikTok', url: tiktokUrl, blurb: 'Teacher demos and in-studio moments' },
    { label: 'Facebook', url: facebookUrl, blurb: 'Community updates and events' },
    { label: 'YouTube', url: youtubeUrl, blurb: 'Long-form tutorials and performances' },
  ].filter((link): link is { label: string; url: string; blurb: string } => Boolean(link.url))

  const upcomingClasses = Object.values(classesByDate).flatMap((dayClasses) => dayClasses ?? [])
  const teacherSpotlightMap = new Map<string, TeacherSpotlight>()

  for (const profile of teacherProfiles) {
    const instagramProfileUrl = normalizeSocialUrl(profile.instagram, 'instagram') ?? ''
    teacherSpotlightMap.set(normalizePersonKey(profile.name), {
      name: profile.name,
      classCount: 0,
      nextClassLabel: '',
      bio: profile.bio,
      role: profile.role,
      photoUrl: firstNonEmptyString(profile.photo_url, getLocalInstagramAvatarUrl(instagramProfileUrl)) ?? '',
      socials: [
        { label: 'Instagram', url: instagramProfileUrl },
        { label: 'TikTok', url: normalizeSocialUrl(profile.tiktok, 'tiktok') ?? '' },
        { label: 'Facebook', url: normalizeSocialUrl(profile.facebook, 'facebook') ?? '' },
        { label: 'YouTube', url: normalizeSocialUrl(profile.youtube, 'youtube') ?? '' },
      ].filter((social) => social.url.length > 0),
      mediaUrls: profile.media_urls,
    })
  }

  for (const cls of upcomingClasses) {
    const teacherName = cls.teacher?.name
    if (!teacherName) continue

    const teacherKey = normalizePersonKey(teacherName)
    const entry = teacherSpotlightMap.get(teacherKey)
    if (entry) {
      entry.classCount += 1
      if (!entry.nextClassLabel) {
        entry.nextClassLabel = `${formatDate(cls.date)} · ${formatTime(cls.start_time)}`
      }
      continue
    }

    const configured = configuredTeacherByName.get(teacherKey)
    const instagramProfileUrl = normalizeSocialUrl(configured?.instagram, 'instagram') ?? ''
    teacherSpotlightMap.set(teacherKey, {
      name: configured?.name ?? teacherName,
      classCount: 1,
      nextClassLabel: `${formatDate(cls.date)} · ${formatTime(cls.start_time)}`,
      bio: configured?.bio ?? '',
      role: configured?.role ?? '',
      photoUrl: firstNonEmptyString(configured?.photo_url, getLocalInstagramAvatarUrl(instagramProfileUrl)) ?? '',
      socials: [
        { label: 'Instagram', url: instagramProfileUrl },
        { label: 'TikTok', url: normalizeSocialUrl(configured?.tiktok, 'tiktok') ?? '' },
        { label: 'Facebook', url: normalizeSocialUrl(configured?.facebook, 'facebook') ?? '' },
        { label: 'YouTube', url: normalizeSocialUrl(configured?.youtube, 'youtube') ?? '' },
      ].filter((social) => social.url.length > 0),
      mediaUrls: configured?.media_urls ?? [],
    })
  }

  const teacherSpotlights = Array.from(teacherSpotlightMap.values())
    .sort((a, b) => {
      if (b.classCount !== a.classCount) return b.classCount - a.classCount
      const aScore = (a.socials.length > 0 ? 1 : 0) + (a.mediaUrls.length > 0 ? 1 : 0)
      const bScore = (b.socials.length > 0 ? 1 : 0) + (b.mediaUrls.length > 0 ? 1 : 0)
      return bScore - aScore
    })
    .slice(0, 6)

  const teachersWithClasses = teacherSpotlights.filter((teacher) => teacher.classCount > 0)
  const heroTeacher = teachersWithClasses[0] ?? teacherSpotlights[0]
  const supportingTeachers = [
    ...teachersWithClasses.filter((teacher) => teacher.name !== heroTeacher?.name),
    ...teacherSpotlights.filter((teacher) => teacher.classCount === 0 && teacher.name !== heroTeacher?.name),
  ].slice(0, 3)

  const socialGallery = [
    ...getMediaUrlsFromSettings(settings),
    ...teacherSpotlights.flatMap((teacher) => teacher.mediaUrls),
    ...socialLinks.map((social) => social.url),
  ]
    .filter((url, index, arr) => arr.findIndex((candidate) => candidate.toLowerCase() === url.toLowerCase()) === index)
    .slice(0, 12)

  const socialHighlights = socialGallery.map((url) => {
    const type = getMediaType(url)
    return {
      url,
      type,
      label: getSocialPlatformLabel(type),
      title: getMediaTitle(url, type),
      host: getMediaHost(url),
      embedUrl: getSocialEmbedUrl(url, type),
      previewImage: type === 'image' ? url : type === 'instagram' ? getLocalInstagramAvatarUrl(url) : null,
    }
  })

  const getTeacherPhotoSrc = (
    teacher: Pick<TeacherSpotlight, 'photoUrl' | 'socials'>,
    options?: { allowHeroFallback?: boolean }
  ) => {
    const instagramAvatar = getLocalInstagramAvatarUrl(getTeacherInstagramUrl(teacher.socials))
    const directSource = firstNonEmptyString(teacher.photoUrl, instagramAvatar)
    if (directSource) return directSource
    if (options?.allowHeroFallback) return heroImageUrl
    return null
  }
  const socialFallbackImages = [
    ...teacherSpotlights
      .map((teacher) => getTeacherPhotoSrc(teacher))
      .filter((photo): photo is string => Boolean(photo)),
    heroImageUrl,
  ].filter((photo, index, arr) => arr.indexOf(photo) === index)

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: studio.name,
    description: studio.description ?? undefined,
    sport: studio.discipline,
    ...(address ? { address: { '@type': 'PostalAddress', streetAddress: address } } : {}),
    ...(logoUrl ? { image: logoUrl } : {}),
    ...(studioEmail ? { email: studioEmail } : {}),
    url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://studio.coop'}/${slug}`,
  }

  return (
    <div className="marketing-page min-h-screen text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="sticky top-0 z-20 border-b border-white/50 bg-background/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={studio.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {studio.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="marketing-display text-lg font-semibold tracking-tight">{studio.name}</span>
          </Link>
          <div className="flex items-center gap-4">
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener" className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">
                Instagram
              </a>
            )}
            <Link
              href={`/login?studio=${slug}`}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Book Now
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div>
            <span className="inline-flex items-center rounded-full border border-primary/25 bg-card/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {studio.discipline}
            </span>
            <h1 className="marketing-display mt-5 text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
              Try your first class at {studio.name}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {studio.description ?? `Join ${studio.name} for welcoming, community-first classes built for all experience levels.`}
            </p>

            <ul className="mt-6 space-y-2">
              {welcomePointers.map((pointer) => (
                <li key={pointer} className="flex items-start gap-2 text-sm text-foreground/85">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{pointer}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/login?studio=${slug}`}
                className="inline-flex items-center rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Book your first class
              </Link>
              <a
                href="#schedule"
                className="inline-flex items-center rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                View upcoming classes
              </a>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                <p className="marketing-display text-2xl font-semibold">Warm</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">First-timer welcome</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                <p className="marketing-display text-2xl font-semibold">{upcomingClassCount}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">Upcoming classes</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/80 p-4 sm:col-span-1 col-span-2">
                <p className="marketing-display text-2xl font-semibold">100%</p>
                <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">First class support</p>
              </div>
            </div>

            {address && (
              <p className="mt-5 text-sm text-muted-foreground">{address}</p>
            )}
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-card shadow-[0_22px_70px_-42px_rgba(20,28,42,0.42)]">
              <img
                src={heroImageUrl}
                alt={`${studio.name} class in session`}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-lg backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">New here?</p>
              <p className="mt-1 text-sm text-foreground">
                Tell the teacher it is your first class and they will guide you through everything from warm-up to finish.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/75">
          <div className="mx-auto w-full max-w-6xl px-6 py-12">
            <h2 className="marketing-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              What to expect in your first class
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 1</p>
                <h3 className="marketing-display mt-2 text-xl font-semibold">Pick your class</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Choose a class below and book online in less than a minute.
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 2</p>
                <h3 className="marketing-display mt-2 text-xl font-semibold">Arrive 10 minutes early</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We will get you checked in, settled, and ready with no rush.
                </p>
              </article>
              <article className="rounded-2xl border border-border/70 bg-background/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Step 3</p>
                <h3 className="marketing-display mt-2 text-xl font-semibold">Feel supported from day one</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Teachers adapt cues for beginners so you can build confidence safely.
                </p>
              </article>
            </div>
          </div>
        </section>

        {(teacherSpotlights.length > 0 || socialLinks.length > 0) && (
          <section className="border-y border-border/60 bg-card/75">
            <div className="mx-auto w-full max-w-6xl px-6 py-14">
              <div className="grid gap-7 lg:grid-cols-[1.06fr_0.94fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Teacher spotlight</p>
                  <h2 className="marketing-display mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                    Meet the people behind your progress
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Classes are the entry point. Relationships with teachers are what make people stay, grow, and come back.
                  </p>

                  {heroTeacher && (
                    <article className="mt-6 overflow-hidden rounded-3xl border border-white/75 bg-background/85 shadow-[0_20px_60px_-42px_rgba(16,24,40,0.45)]">
                      <div className="relative">
                        <img
                          src={getTeacherPhotoSrc(heroTeacher, { allowHeroFallback: true }) ?? heroImageUrl}
                          alt={`${heroTeacher.name} at ${studio.name}`}
                          className="aspect-[16/10] w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                        <div className="absolute bottom-4 left-4 rounded-xl border border-white/40 bg-black/35 px-3 py-2 backdrop-blur">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">
                            {heroTeacher.role || 'Coach'}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">{heroTeacher.name}</p>
                        </div>
                      </div>

                      <div className="space-y-4 p-6">
                        <p className="text-sm leading-relaxed text-foreground/90">
                          {heroTeacher.bio || `${heroTeacher.name} helps first-timers build confidence from class one.`}
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-border/70 bg-card/85 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Upcoming classes</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {heroTeacher.classCount || upcomingClassCount}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border/70 bg-card/85 p-3">
                            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Next class</p>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {heroTeacher.nextClassLabel || 'Schedule live now'}
                            </p>
                          </div>
                        </div>
                        <Link
                          href={`/${slug}/teachers/${toTeacherSlug(heroTeacher.name)}`}
                          className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/35"
                        >
                          View full profile
                        </Link>
                        <div className="flex flex-wrap gap-2">
                          {(heroTeacher.socials.length > 0
                            ? heroTeacher.socials
                            : socialLinks.map((social) => ({ label: social.label, url: social.url }))
                          )
                            .slice(0, 4)
                            .map((social) => (
                              <a
                                key={`${heroTeacher.name}-${social.label}`}
                                href={social.url}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/35"
                              >
                                {social.label}
                              </a>
                            ))}
                        </div>
                      </div>
                    </article>
                  )}
                </div>

                <div className="space-y-4">
                  {supportingTeachers.length > 0 ? (
                    supportingTeachers.map((teacher) => {
                      const teacherPhoto = getTeacherPhotoSrc(teacher)
                      const teacherProfileHref = `/${slug}/teachers/${toTeacherSlug(teacher.name)}`
                      const initials = teacher.name
                        .replace(/\./g, '')
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() ?? '')
                        .join('')

                      return (
                        <Link
                          key={teacher.name}
                          href={teacherProfileHref}
                          className="block rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm transition-colors hover:border-primary/35"
                        >
                          <div className="flex items-start gap-3">
                            {teacherPhoto ? (
                              <img
                                src={teacherPhoto}
                                alt={teacher.name}
                                className="h-14 w-14 rounded-xl object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-foreground/80">
                                {initials || 'CO'}
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground">{teacher.name}</p>
                              {teacher.role && <p className="text-xs text-muted-foreground">{teacher.role}</p>}
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {teacher.bio || `${teacher.name} welcomes first-time members and supports every level.`}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {teacher.classCount > 0
                                  ? `${teacher.classCount} upcoming class${teacher.classCount !== 1 ? 'es' : ''}`
                                  : 'Schedule publishing soon'}
                                {teacher.classCount > 0 && teacher.nextClassLabel ? ` · next ${teacher.nextClassLabel}` : ''}
                              </p>
                            </div>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <article className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                      <p className="text-sm font-semibold text-foreground">First class friendly instructors</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        This studio team is focused on helping new members settle in quickly and feel welcome.
                      </p>
                    </article>
                  )}

                  {socialLinks.length > 0 && (
                    <article className="rounded-2xl border border-border/70 bg-background/80 p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Studio channels</p>
                      <h3 className="marketing-display mt-2 text-2xl font-semibold tracking-tight text-foreground">
                        Follow before your first booking
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        See how teachers coach, how members progress, and what class energy feels like.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {socialLinks.map((social) => (
                          <a
                            key={social.label}
                            href={social.url}
                            target="_blank"
                            rel="noopener"
                            className="rounded-xl border border-border/70 bg-card/85 p-3 transition-colors hover:border-primary/40"
                          >
                            <p className="text-sm font-semibold text-foreground">{social.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{social.blurb}</p>
                          </a>
                        ))}
                      </div>
                    </article>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {socialHighlights.length > 0 && (
          <section className="mx-auto w-full max-w-6xl px-6 py-14">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Social wall</p>
                <h2 className="marketing-display mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  From social feed to studio floor
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Discover the teachers, style, and community vibe through the same content this studio shares publicly.
                </p>
              </div>
              <a
                href={instagramUrl ?? websiteUrl ?? '#schedule'}
                target={instagramUrl || websiteUrl ? '_blank' : undefined}
                rel={instagramUrl || websiteUrl ? 'noopener' : undefined}
                className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/35"
              >
                Open social profiles
              </a>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {socialHighlights.map((item, index) => {
                const cardImage = item.previewImage
                  ?? (socialFallbackImages.length > 0 ? socialFallbackImages[index % socialFallbackImages.length] : null)

                return (
                  <a
                    key={`${item.url}-${index}`}
                    href={item.url}
                    target="_blank"
                    rel="noopener"
                    className="group overflow-hidden rounded-2xl border border-border/70 bg-card/90 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                  >
                    {item.type === 'video' ? (
                      <video
                        src={item.url}
                        controls
                        playsInline
                        className="aspect-[4/3] w-full bg-black object-cover"
                      />
                    ) : item.embedUrl ? (
                      <iframe
                        src={item.embedUrl}
                        title={item.title}
                        loading="lazy"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="aspect-[4/3] w-full border-0 bg-background"
                      />
                    ) : cardImage ? (
                      <img
                        src={cardImage}
                        alt={item.title}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex min-h-[190px] flex-col justify-between bg-gradient-to-br from-[#FFF2E8] via-[#F6F9F8] to-[#EAF5F2] p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{item.label}</p>
                        <div>
                          <p className="text-base font-semibold text-foreground">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.host}</p>
                        </div>
                      </div>
                    )}
                    {(cardImage || item.type === 'video' || item.embedUrl) && (
                      <div className="border-t border-border/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{item.label}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{item.host}</p>
                      </div>
                    )}
                  </a>
                )
              })}
            </div>
          </section>
        )}

        <section id="schedule" className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="marketing-display text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Upcoming Classes
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            {scheduleSubtitle ?? 'Pick a class time that works for you and book your first session today.'}
          </p>

          {Object.keys(classesByDate).length === 0 ? (
            <p className="py-14 text-center text-muted-foreground">No upcoming classes scheduled.</p>
          ) : (
            <div className="mt-10 space-y-8">
              {Object.entries(classesByDate).slice(0, 5).map(([date, dayClasses]) => (
                <div key={date}>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-3">
                    {dayClasses!.map((cls) => {
                      const maxCapacity = typeof cls.max_capacity === 'number' ? cls.max_capacity : null
                      const bookedCount = typeof cls.booked_count === 'number' ? cls.booked_count : 0
                      const availableSpots = maxCapacity !== null ? Math.max(maxCapacity - bookedCount, 0) : null
                      const isLowSpots = availableSpots !== null && availableSpots <= 2

                      return (
                        <article key={cls.id} className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-lg font-semibold text-foreground">{cls.template?.name ?? 'Class'}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatTime(cls.start_time)} - {formatTime(cls.end_time)}
                                {cls.teacher?.name && (
                                  <>
                                    {' · '}
                                    <Link
                                      href={`/${slug}/teachers/${toTeacherSlug(cls.teacher.name)}`}
                                      className="font-medium text-foreground transition-colors hover:text-primary"
                                    >
                                      {cls.teacher.name}
                                    </Link>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLowSpots ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {availableSpots === null ? 'Spots available' : `${availableSpots} spots left`}
                              </span>
                              <Link
                                href={`/login?studio=${slug}`}
                                className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                              >
                                Book
                              </Link>
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            First class? Let your teacher know at check-in and they will help you get started.
                          </p>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {plans.length > 0 && (
          <section id="membership" className="border-t border-border/60 bg-card/70">
            <div className="mx-auto w-full max-w-6xl px-6 py-16">
              <h2 className="marketing-display text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Membership &amp; Pricing
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
                Choose the option that fits your class rhythm. Start simple and upgrade anytime.
              </p>

              <div className={`mt-10 grid gap-6 ${plans.length === 1 ? 'mx-auto max-w-sm' : plans.length === 2 ? 'mx-auto max-w-2xl md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {plans.map((plan) => {
                  const isUnlimited = plan.type === 'unlimited'
                  return (
                    <article
                      key={plan.id}
                      className={`flex flex-col rounded-2xl border p-6 ${isUnlimited ? 'border-primary bg-primary/5' : 'border-border/70 bg-card'}`}
                    >
                      {isUnlimited && (
                        <span className="mb-3 inline-flex w-fit items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                          Most popular
                        </span>
                      )}
                      <h3 className="marketing-display text-2xl font-semibold tracking-tight text-foreground">{plan.name}</h3>
                      {plan.description && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{plan.description}</p>
                      )}
                      <div className="mt-5 flex items-baseline gap-1">
                        <span className="marketing-display text-3xl font-semibold text-foreground">{formatPlanPrice(plan)}</span>
                        {formatPlanInterval(plan) && <span className="text-sm text-muted-foreground">{formatPlanInterval(plan)}</span>}
                      </div>
                      {plan.class_limit && plan.type === 'class_pack' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.class_limit} classes{plan.validity_days ? ` · valid ${plan.validity_days} days` : ''}
                        </p>
                      )}
                      {plan.type === 'limited' && plan.class_limit && (
                        <p className="mt-1 text-xs text-muted-foreground">Up to {plan.class_limit} classes / month</p>
                      )}
                      <Link
                        href={`/login?studio=${slug}`}
                        className={`mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                          isUnlimited
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-border bg-card text-foreground hover:bg-secondary'
                        }`}
                      >
                        {plan.type === 'drop_in' ? 'Book a class' : plan.interval === 'once' ? 'Buy now' : 'Get started'}
                      </Link>
                    </article>
                  )
                })}
              </div>

              <div className="mt-8 text-center">
                <CouponInput studioId={studio.id} />
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-4">
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
                Instagram
              </a>
            )}
            {tiktokUrl && (
              <a href={tiktokUrl} target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
                TikTok
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
                Facebook
              </a>
            )}
            {youtubeUrl && (
              <a href={youtubeUrl} target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
                YouTube
              </a>
            )}
            {websiteUrl && (
              <a href={websiteUrl} target="_blank" rel="noopener" className="transition-colors hover:text-foreground">
                Website
              </a>
            )}
            {studioEmail && <span>{studioEmail}</span>}
            {studioPhone && <span>{studioPhone}</span>}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="transition-colors hover:text-foreground">Browse more studios</Link>
            <span>Powered by</span>
            <Link href="/" className="font-semibold text-foreground transition-colors hover:text-primary">Studio Co-op</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
