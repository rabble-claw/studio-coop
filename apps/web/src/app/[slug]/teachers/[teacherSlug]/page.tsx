import { notFound, permanentRedirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatTime } from '@/lib/utils'
import { resolveStudioSlug } from '@/lib/studio-slugs'

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
  for (const cls of primary) merged.set(classDisplayKey(cls), cls)
  for (const cls of fallback) {
    if (!merged.has(classDisplayKey(cls))) merged.set(classDisplayKey(cls), cls)
  }
  return Array.from(merged.values())
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
    .slice(0, 40)
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

async function getTeacherPageData(studioSlug: string, teacherSlug: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const { data: studio } = await supabase.from('studios').select('*').eq('slug', studioSlug).single()
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
    .limit(40)

  const settings = (studio.settings ?? {}) as Record<string, unknown>
  const logoUrl = getStudioLogoUrl({ name: studio.name, slug: studio.slug, logo_url: studio.logo_url }, settings)
  const heroImageUrl = getStudioHeroImageUrl({ name: studio.name, slug: studio.slug }, settings)

  const dbClasses = (classes ?? []) as PublicClassForDisplay[]
  const classesForDisplay = isEmpireStudio(studio)
    ? mergeDisplayClasses(dbClasses, buildEmpireMindbodyImportedClasses())
    : dbClasses

  const configuredTeacherProfiles = getTeacherSpotlightsFromSettings(settings)
  const teacherProfiles = configuredTeacherProfiles.length > 0
    ? configuredTeacherProfiles
    : getEmpireTeacherFallbacks(studio)

  const configuredTeacherByName = new Map<string, TeacherPublicProfile>()
  for (const profile of teacherProfiles) {
    configuredTeacherByName.set(profile.name.toLowerCase(), profile)
    configuredTeacherByName.set(normalizePersonKey(profile.name), profile)
  }

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

  for (const cls of classesForDisplay) {
    const teacherName = cls.teacher?.name
    if (!teacherName) continue

    const normalizedKey = normalizePersonKey(teacherName)
    const entry = teacherSpotlightMap.get(normalizedKey)
    if (entry) {
      entry.classCount += 1
      if (!entry.nextClassLabel) {
        entry.nextClassLabel = `${formatDate(cls.date)} · ${formatTime(cls.start_time)}`
      }
      continue
    }

    const configured = configuredTeacherByName.get(teacherName.toLowerCase()) ?? configuredTeacherByName.get(normalizedKey)
    const instagramProfileUrl = normalizeSocialUrl(configured?.instagram, 'instagram') ?? ''

    teacherSpotlightMap.set(normalizedKey, {
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
  const teacher = teacherSpotlights.find((candidate) => toTeacherSlug(candidate.name) === teacherSlug)
    ?? teacherSpotlights.find((candidate) => normalizePersonKey(candidate.name) === normalizePersonKey(teacherSlug.replace(/-/g, ' ')))

  if (!teacher) {
    return {
      studio,
      logoUrl,
      heroImageUrl,
      teacher: null,
      classesByDate: {} as Record<string, PublicClassForDisplay[]>,
      socialHighlights: [],
    }
  }

  const teacherKey = normalizePersonKey(teacher.name)
  const teacherClasses = classesForDisplay
    .filter((cls) => normalizePersonKey(cls.teacher?.name ?? '') === teacherKey)
    .slice(0, 20)

  const classesByDate = teacherClasses.reduce<Record<string, PublicClassForDisplay[]>>((acc, cls) => {
    if (!acc[cls.date]) acc[cls.date] = []
    acc[cls.date]!.push(cls)
    return acc
  }, {})

  const socialGallery = [
    ...teacher.mediaUrls,
    ...teacher.socials.map((social) => social.url),
    ...getMediaUrlsFromSettings(settings),
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

  return {
    studio,
    logoUrl,
    heroImageUrl,
    teacher,
    classesByDate,
    socialHighlights,
  }
}

const RESERVED_SLUGS = ['api', 'login', 'dashboard', 'demo', 'admin', 'signup', 'forgot-password', 'explore']

export default async function PublicTeacherPage({ params }: { params: Promise<{ slug: string; teacherSlug: string }> }) {
  const { slug, teacherSlug } = await params
  const canonicalSlug = resolveStudioSlug(slug)
  if (canonicalSlug !== slug) {
    permanentRedirect(`/${canonicalSlug}/teachers/${teacherSlug}`)
  }
  if (RESERVED_SLUGS.includes(canonicalSlug)) notFound()

  const data = await getTeacherPageData(canonicalSlug, teacherSlug)
  if (!data || !data.teacher) notFound()

  const { studio, logoUrl, heroImageUrl, teacher, classesByDate, socialHighlights } = data

  const teacherPhoto = firstNonEmptyString(
    teacher.photoUrl,
    getLocalInstagramAvatarUrl(getTeacherInstagramUrl(teacher.socials)),
    heroImageUrl
  ) ?? heroImageUrl

  const mediaFallbackImages = [teacherPhoto, heroImageUrl].filter((image, index, arr) => arr.indexOf(image) === index)

  return (
    <div className="marketing-page min-h-screen text-foreground">
      <header className="sticky top-0 z-20 border-b border-white/50 bg-background/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href={`/${canonicalSlug}`} className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={studio.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                {studio.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="marketing-display text-lg font-semibold tracking-tight">{studio.name}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/${canonicalSlug}#schedule`}
              className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-primary/35"
            >
              All classes
            </Link>
            <Link
              href={`/login?studio=${canonicalSlug}&teacher=${encodeURIComponent(teacher.name)}`}
              className="inline-flex items-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Book with {teacher.name.split(' ')[0]}
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div className="overflow-hidden rounded-3xl border border-white/75 bg-card shadow-[0_22px_70px_-42px_rgba(20,28,42,0.42)]">
            <div className="relative">
              <img
                src={teacherPhoto}
                alt={`${teacher.name} at ${studio.name}`}
                className="aspect-[4/5] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 rounded-xl border border-white/40 bg-black/35 px-3 py-2 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85">{teacher.role || 'Coach'}</p>
                <p className="mt-1 text-sm font-semibold text-white">{teacher.name}</p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Teacher profile</p>
            <h1 className="marketing-display mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {teacher.name}
            </h1>
            {teacher.role && <p className="mt-2 text-sm font-medium text-foreground/80">{teacher.role}</p>}
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {teacher.bio || `${teacher.name} coaches with a focus on progress, confidence, and consistency.`}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-card/85 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Upcoming classes</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{teacher.classCount}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/85 p-4">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Next class</p>
                <p className="mt-1 text-sm font-medium text-foreground">{teacher.nextClassLabel || 'Schedule live now'}</p>
              </div>
            </div>

            {teacher.socials.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {teacher.socials.map((social) => (
                  <a
                    key={`${teacher.name}-${social.label}`}
                    href={social.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/35"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {socialHighlights.length > 0 && (
          <section className="border-y border-border/60 bg-card/70">
            <div className="mx-auto w-full max-w-6xl px-6 py-14">
              <h2 className="marketing-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Media & social
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Learn this teacher's style before class. Watch clips, see photos, and get familiar with their coaching vibe.
              </p>

              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {socialHighlights.map((item, index) => {
                  const cardImage = item.previewImage
                    ?? (mediaFallbackImages.length > 0 ? mediaFallbackImages[index % mediaFallbackImages.length] : null)

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
            </div>
          </section>
        )}

        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="marketing-display text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Book classes with {teacher.name}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Pick a time that fits and reserve your spot.
          </p>

          {Object.keys(classesByDate).length === 0 ? (
            <p className="py-14 text-center text-muted-foreground">No upcoming classes found for this teacher right now.</p>
          ) : (
            <div className="mt-10 space-y-8">
              {Object.entries(classesByDate).map(([date, dayClasses]) => (
                <div key={date}>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDate(date)}
                  </h3>
                  <div className="space-y-3">
                    {dayClasses.map((cls) => {
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
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isLowSpots ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {availableSpots === null ? 'Spots available' : `${availableSpots} spots left`}
                              </span>
                              <Link
                                href={`/login?studio=${canonicalSlug}&teacher=${encodeURIComponent(teacher.name)}`}
                                className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                              >
                                Book now
                              </Link>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              href={`/${canonicalSlug}`}
              className="inline-flex items-center rounded-full border border-border bg-card px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/35"
            >
              Back to studio page
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
