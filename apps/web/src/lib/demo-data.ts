// Demo data for Empire Aerial Arts — used when NEXT_PUBLIC_SUPABASE_URL is not configured

/** Get the local date string (YYYY-MM-DD) for a given timezone. */
export function getLocalDateStr(timezone: string = 'Pacific/Auckland'): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone }) // en-CA gives YYYY-MM-DD
}

/** Deterministic pseudo-random number from a string seed (0..1). */
function seededRandom(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash % 100) / 100
}

const STUDIO_ID = 'demo-empire-001'
const TEACHER_EMMA_ID = 'demo-teacher-emma'
const TEACHER_JADE_ID = 'demo-teacher-jade'
const TEACHER_SAM_ID = 'demo-teacher-sam'
const TEACHER_ARIA_ID = 'demo-teacher-aria'

export const isDemoMode = () => {
  // Explicitly disabled
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false') return false
  // Explicitly enabled
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return true
  // Legacy: demo if Supabase URL is placeholder and no demo mode override
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')
  )
}

export const demoStudio = {
  id: STUDIO_ID,
  name: 'Empire Aerial Arts',
  slug: 'empire-aerial-arts',
  discipline: 'pole',
  description:
    'A queer-owned boutique studio in a gorgeously secret location right in the middle of Wellington\'s central Cuba Street! Our instructors all bring a love of sharing their skills with new learners, and our classes are for all adults of all experience levels.',
  timezone: 'Pacific/Auckland',
  tier: 'studio',
  created_at: '2024-01-15T00:00:00Z',
  settings: {
    brandColor: '#7c3aed',
    address: 'Cuba Street, Wellington, New Zealand',
    contactEmail: 'hello@empireaerialarts.com',
    website: 'https://empireaerialarts.com',
  },
}

export const demoTeachers = [
  { id: TEACHER_EMMA_ID, name: 'Alex', email: 'alex@empireaerialarts.com', avatar_url: null },
  { id: TEACHER_JADE_ID, name: 'Jade', email: 'jade@empireaerialarts.com', avatar_url: null },
  { id: TEACHER_SAM_ID, name: 'Sam', email: 'sam@empireaerialarts.com', avatar_url: null },
  { id: TEACHER_ARIA_ID, name: 'Aria', email: 'aria@empireaerialarts.com', avatar_url: null },
]

export const demoTemplates = [
  {
    id: 'tpl-pole-1',
    name: 'Pole Technique Level 1',
    description: 'Brand new to pole dance? Level 1 is perfect for you! We\'ll take care of you from your very first spin.',
    discipline_config: { level: 1, style: 'technique' },
    default_duration_min: 60,
    default_capacity: 12,
  },
  {
    id: 'tpl-pole-2',
    name: 'Pole Technique Level 2',
    description: 'Build on your foundations with inverts, combos, and flow work.',
    discipline_config: { level: 2, style: 'technique' },
    default_duration_min: 60,
    default_capacity: 10,
  },
  {
    id: 'tpl-pole-3',
    name: 'Pole Technique Level 3',
    description: 'Advanced inversions, shoulder mounts, and extended combos.',
    discipline_config: { level: 3, style: 'technique' },
    default_duration_min: 75,
    default_capacity: 8,
  },
  {
    id: 'tpl-pole-flow',
    name: 'Pole Flow & Floorwork',
    description: 'Express yourself through fluid transitions, floorwork, and dance.',
    discipline_config: { style: 'flow' },
    default_duration_min: 60,
    default_capacity: 14,
  },
  {
    id: 'tpl-aerial-hoop',
    name: 'Aerial Hoop (Lyra)',
    description: 'Aerial apparatus technique — graceful spins, poses, and sequences on the hoop. Part of our Movement & Cirque collection.',
    discipline_config: { apparatus: 'hoop' },
    default_duration_min: 60,
    default_capacity: 8,
  },
  {
    id: 'tpl-aerial-silks',
    name: 'Aerial Silks',
    description: 'Climb, wrap, and drop on silks. Strength and flexibility in the air.',
    discipline_config: { apparatus: 'silks' },
    default_duration_min: 60,
    default_capacity: 6,
  },
  {
    id: 'tpl-handbalance',
    name: 'Handbalance',
    description: 'Part of our Movement & Cirque suite — handstands, press work, and balance skills.',
    discipline_config: { style: 'acro' },
    default_duration_min: 60,
    default_capacity: 12,
  },
  {
    id: 'tpl-flex',
    name: 'Flexibility & Conditioning',
    description: 'New to fitness but can\'t get into the gym life? Work on those splits and backbends with active flexibility and a little cardio in our lush spaces!',
    discipline_config: { style: 'conditioning' },
    default_duration_min: 50,
    default_capacity: 16,
  },
  {
    id: 'tpl-hula-hoop',
    name: 'Hula Hoop',
    description: 'Incredibly fun cirque skills! Find a new way to have fun and move with hula hoop flow and tricks.',
    discipline_config: { apparatus: 'hula-hoop' },
    default_duration_min: 60,
    default_capacity: 14,
  },
  {
    id: 'tpl-open-practice',
    name: 'Open Practice',
    description: 'Unstructured studio time to work on your own skills. All levels.',
    discipline_config: { style: 'open' },
    default_duration_min: 90,
    default_capacity: 20,
  },
]

function generateWeekSchedule(): typeof demoClasses {
  const classes: typeof demoClasses = []
  const today = new Date()
  const teachers = [TEACHER_EMMA_ID, TEACHER_JADE_ID, TEACHER_SAM_ID, TEACHER_ARIA_ID]
  const teacherMap: Record<string, string> = {
    [TEACHER_EMMA_ID]: 'Alex',
    [TEACHER_JADE_ID]: 'Jade',
    [TEACHER_SAM_ID]: 'Sam',
    [TEACHER_ARIA_ID]: 'Aria',
  }

  // Weekday schedule (Mon-Fri)
  const weekdaySlots = [
    { time: '17:30', end: '18:30', templates: ['tpl-pole-1', 'tpl-aerial-hoop', 'tpl-flex'] },
    { time: '18:45', end: '19:45', templates: ['tpl-pole-2', 'tpl-pole-flow', 'tpl-aerial-silks'] },
    { time: '20:00', end: '21:00', templates: ['tpl-pole-3', 'tpl-handbalance', 'tpl-hula-hoop'] },
  ]

  // Weekend schedule
  const weekendSlots = [
    { time: '09:00', end: '10:00', templates: ['tpl-pole-1', 'tpl-flex'] },
    { time: '10:15', end: '11:15', templates: ['tpl-aerial-hoop', 'tpl-pole-flow'] },
    { time: '11:30', end: '13:00', templates: ['tpl-open-practice'] },
    { time: '13:30', end: '14:30', templates: ['tpl-pole-2', 'tpl-aerial-silks'] },
  ]

  const todayStr = getLocalDateStr(demoStudio.timezone)

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today)
    date.setDate(today.getDate() + dayOffset)
    const dayOfWeek = date.getDay()
    // Build YYYY-MM-DD relative to today's local date
    const [y, m, d] = todayStr.split('-').map(Number)
    const offsetDate = new Date(y!, m! - 1, d! + dayOffset)
    const dateStr = `${offsetDate.getFullYear()}-${String(offsetDate.getMonth() + 1).padStart(2, '0')}-${String(offsetDate.getDate()).padStart(2, '0')}`

    const slots = dayOfWeek === 0 || dayOfWeek === 6 ? weekendSlots : weekdaySlots
    if (dayOfWeek === 0 && dayOffset > 7) continue // skip second Sunday

    for (const slot of slots) {
      const tplId = slot.templates[dayOffset % slot.templates.length]
      const tpl = demoTemplates.find((t) => t.id === tplId)!
      const teacherId = teachers[(dayOffset + slots.indexOf(slot)) % teachers.length]
      const classId = `cls-${dateStr}-${slot.time.replace(':', '')}`
      const booked = Math.floor(seededRandom(classId) * (tpl.default_capacity - 2)) + 1

      classes.push({
        id: classId,
        studio_id: STUDIO_ID,
        template_id: tplId,
        teacher_id: teacherId,
        date: dateStr,
        start_time: slot.time + ':00',
        end_time: slot.end + ':00',
        max_capacity: tpl.default_capacity,
        booked_count: booked,
        status: 'scheduled',
        template: { name: tpl.name, description: tpl.description },
        teacher: { id: teacherId, name: teacherMap[teacherId] },
      })
    }
  }
  return classes
}

export interface DemoClass {
  id: string
  studio_id: string
  template_id: string
  teacher_id: string
  date: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  status: string
  template: { name: string; description: string }
  teacher: { id: string; name: string }
}

export const demoClasses: DemoClass[] = generateWeekSchedule()

export const demoMembers = [
  { id: 'member-1', name: 'Rabble', email: 'rabble@example.com', role: 'member', joined: '2025-06-01', avatar_url: null },
  { id: 'member-2', name: 'Kai', email: 'kai@example.com', role: 'member', joined: '2025-07-15', avatar_url: null },
  { id: 'member-3', name: 'Mia', email: 'mia@example.com', role: 'member', joined: '2025-03-10', avatar_url: null },
  { id: 'member-4', name: 'Alex', email: 'alex@example.com', role: 'member', joined: '2025-09-20', avatar_url: null },
  { id: 'member-5', name: 'Jordan', email: 'jordan@example.com', role: 'member', joined: '2025-11-01', avatar_url: null },
  { id: 'member-6', name: 'Riley', email: 'riley@example.com', role: 'member', joined: '2024-12-05', avatar_url: null },
  { id: 'member-7', name: 'Quinn', email: 'quinn@example.com', role: 'member', joined: '2025-01-22', avatar_url: null },
  { id: 'member-8', name: 'Avery', email: 'avery@example.com', role: 'member', joined: '2025-04-18', avatar_url: null },
  { id: TEACHER_EMMA_ID, name: 'Alex', email: 'alex@empireaerialarts.com', role: 'owner', joined: '2024-01-15', avatar_url: null },
  { id: TEACHER_JADE_ID, name: 'Jade', email: 'jade@empireaerialarts.com', role: 'teacher', joined: '2024-02-01', avatar_url: null },
  { id: TEACHER_SAM_ID, name: 'Sam', email: 'sam@empireaerialarts.com', role: 'teacher', joined: '2024-03-10', avatar_url: null },
  { id: TEACHER_ARIA_ID, name: 'Aria', email: 'aria@empireaerialarts.com', role: 'teacher', joined: '2024-06-01', avatar_url: null },
]

export interface DemoFeedPost {
  id: string
  author: string
  author_id: string
  content: string
  created_at: string
  class_name: string | null
  class_id: string | null
  post_type: 'post' | 'milestone' | 'media'
  media_urls: string[]
  reactions: Array<{ emoji: string; count: number }>
}

export const demoFeedPosts: DemoFeedPost[] = [
  {
    id: 'post-1',
    author: 'Alex',
    author_id: TEACHER_EMMA_ID,
    content: 'Amazing progress in Level 2 tonight! 🤩 Everyone nailed their first shoulder mount. So proud of this crew.',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    class_name: 'Pole Technique Level 2',
    class_id: demoClasses.find((c) => c.template.name === 'Pole Technique Level 2')?.id ?? null,
    post_type: 'media',
    media_urls: [
      'https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '🔥', count: 5 }, { emoji: '❤️', count: 8 }, { emoji: '👏', count: 3 }],
  },
  {
    id: 'post-2',
    author: 'Jade',
    author_id: TEACHER_JADE_ID,
    content: 'Reminder: Open Practice this Saturday has extra silks rigged! Come play 🎪',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    class_name: null,
    class_id: null,
    post_type: 'post',
    media_urls: [],
    reactions: [{ emoji: '❤️', count: 12 }, { emoji: '🔥', count: 4 }],
  },
  {
    id: 'post-3',
    author: 'Kai',
    author_id: 'member-2',
    content: 'Just booked my first aerial hoop class. Terrified and excited in equal measure 😅',
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    class_name: 'Aerial Hoop (Lyra)',
    class_id: demoClasses.find((c) => c.template.name === 'Aerial Hoop (Lyra)')?.id ?? null,
    post_type: 'post',
    media_urls: [],
    reactions: [{ emoji: '❤️', count: 15 }, { emoji: '👏', count: 7 }],
  },
  {
    id: 'post-5',
    author: 'Mia',
    author_id: 'member-3',
    content: 'Month 6 milestone! 50 classes completed at Empire. This place has changed my life.',
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    class_name: null,
    class_id: null,
    post_type: 'milestone',
    media_urls: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '❤️', count: 22 }, { emoji: '🔥', count: 9 }, { emoji: '👏', count: 14 }],
  },
  {
    id: 'post-4',
    author: 'Sam',
    author_id: TEACHER_SAM_ID,
    content: 'Flexibility class tomorrow — we\'re working on middle splits. Bring your patience and a foam roller! 🧘',
    created_at: new Date(Date.now() - 42 * 60 * 60 * 1000).toISOString(),
    class_name: 'Flexibility & Conditioning',
    class_id: demoClasses.find((c) => c.template.name === 'Flexibility & Conditioning')?.id ?? null,
    post_type: 'post',
    media_urls: [],
    reactions: [{ emoji: '❤️', count: 6 }],
  },
  {
    id: 'post-6',
    author: 'Aria',
    author_id: TEACHER_ARIA_ID,
    content: 'Hoop choreo from last night\'s class — so beautiful when it all comes together! 🎪✨',
    created_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    class_name: 'Aerial Hoop (Lyra)',
    class_id: demoClasses.find((c) => c.template.name === 'Aerial Hoop (Lyra)')?.id ?? null,
    post_type: 'media',
    media_urls: [
      'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '🔥', count: 18 }, { emoji: '❤️', count: 11 }, { emoji: '👏', count: 6 }],
  },
  {
    id: 'post-7',
    author: 'Avery',
    author_id: 'member-8',
    content: 'Handbalance progress check! Three months in and finally holding a solid freestanding handstand for 5 seconds 🤸',
    created_at: new Date(Date.now() - 65 * 60 * 60 * 1000).toISOString(),
    class_name: 'Handbalance',
    class_id: demoClasses.find((c) => c.template.name === 'Handbalance')?.id ?? null,
    post_type: 'media',
    media_urls: [
      'https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '🔥', count: 14 }, { emoji: '👏', count: 20 }],
  },
  {
    id: 'post-8',
    author: 'Quinn',
    author_id: 'member-7',
    content: 'Studio vibes on a Saturday morning. Nothing beats open practice with this crew.',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    class_name: 'Open Practice',
    class_id: demoClasses.find((c) => c.template.name === 'Open Practice')?.id ?? null,
    post_type: 'media',
    media_urls: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '❤️', count: 16 }, { emoji: '🔥', count: 3 }],
  },
]

export const demoUser = {
  id: 'demo-user-rabble',
  email: 'rabble@example.com',
  name: 'Rabble',
}

export const demoMembership = {
  studio_id: STUDIO_ID,
  role: 'owner' as const,
  status: 'active' as const,
  studios: demoStudio,
}

// ============================================================
// V2: Membership Plans & Coupons
// ============================================================

export const demoMembershipPlans = [
  {
    id: 'plan-unlimited',
    studio_id: STUDIO_ID,
    name: 'Unlimited Monthly',
    description: 'Unlimited classes every month. The best value if you love to train! Come as often as you like.',
    type: 'unlimited' as const,
    price_cents: 18000,
    currency: 'NZD',
    interval: 'month' as const,
    class_limit: null,
    validity_days: null,
    active: true,
    sort_order: 1,
  },
  {
    id: 'plan-8pack',
    studio_id: STUDIO_ID,
    name: '8-Class Pack',
    description: 'Eight classes to use at your own pace. Valid for 60 days from purchase.',
    type: 'class_pack' as const,
    price_cents: 16000,
    currency: 'NZD',
    interval: 'once' as const,
    class_limit: 8,
    validity_days: 60,
    active: true,
    sort_order: 2,
  },
  {
    id: 'plan-dropin',
    studio_id: STUDIO_ID,
    name: 'Drop-In Class',
    description: 'Single class, pay as you go. No commitment needed.',
    type: 'drop_in' as const,
    price_cents: 2500,
    currency: 'NZD',
    interval: 'once' as const,
    class_limit: 1,
    validity_days: null,
    active: true,
    sort_order: 3,
  },
]

export const demoCoupons = [
  {
    id: 'coupon-welcome20',
    studio_id: STUDIO_ID,
    code: 'WELCOME20',
    type: 'percent_off' as const,
    value: 20,
    applies_to: 'new_member' as const,
    max_redemptions: null,
    current_redemptions: 0,
    valid_from: '2026-01-01T00:00:00Z',
    valid_until: '2026-12-31T23:59:59Z',
    active: true,
  },
  {
    id: 'coupon-bringafriend',
    studio_id: STUDIO_ID,
    code: 'BRINGAFRIEND',
    type: 'free_classes' as const,
    value: 1,
    applies_to: 'drop_in' as const,
    max_redemptions: 100,
    current_redemptions: 0,
    valid_from: '2026-02-01T00:00:00Z',
    valid_until: '2026-06-30T23:59:59Z',
    active: true,
  },
]

// ============================================================
// V3: Detail-level data — bookings, attendance, feed, private bookings, reports
// ============================================================

export interface DemoBooking {
  id: string
  class_id: string
  member_id: string
  status: 'booked' | 'confirmed' | 'cancelled'
  booked_at: string
}

function generateBookings(): DemoBooking[] {
  const bookings: DemoBooking[] = []
  const memberIds = demoMembers.filter((m) => m.role === 'member').map((m) => m.id)
  const statuses: DemoBooking['status'][] = ['booked', 'confirmed', 'cancelled']
  let bookingIdx = 0

  for (const cls of demoClasses) {
    // Deterministic "random" based on class id hash
    const seed = cls.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const count = Math.min(cls.booked_count, memberIds.length)
    const shuffled = [...memberIds].sort((a, b) => {
      const ha = a.charCodeAt(a.length - 1) + seed
      const hb = b.charCodeAt(b.length - 1) + seed
      return (ha % 7) - (hb % 7)
    })

    for (let i = 0; i < count; i++) {
      const statusIdx = (seed + i) % 10
      const status: DemoBooking['status'] = statusIdx < 5 ? 'confirmed' : statusIdx < 8 ? 'booked' : 'cancelled'
      bookings.push({
        id: `booking-${bookingIdx++}`,
        class_id: cls.id,
        member_id: shuffled[i]!,
        status,
        booked_at: new Date(Date.now() - (bookingIdx * 3 + 1) * 60 * 60 * 1000).toISOString(),
      })
    }
  }
  return bookings
}

export const demoBookings: DemoBooking[] = generateBookings()

export interface DemoAttendance {
  id: string
  class_id: string
  member_id: string
  checked_in: boolean
  walk_in: boolean
}

function generateAttendance(): DemoAttendance[] {
  const attendance: DemoAttendance[] = []
  const todayStr = getLocalDateStr(demoStudio.timezone)
  let idx = 0

  for (const cls of demoClasses) {
    if (cls.date > todayStr) continue // past and today's classes get attendance
    const classBookings = demoBookings.filter((b) => b.class_id === cls.id && b.status !== 'cancelled')
    for (const booking of classBookings) {
      const seed = booking.id.charCodeAt(booking.id.length - 1)
      attendance.push({
        id: `att-${idx++}`,
        class_id: cls.id,
        member_id: booking.member_id,
        checked_in: seed % 5 !== 0, // ~80% check-in rate
        walk_in: false,
      })
    }
    // Add 1-2 walk-ins for some past classes
    const clsSeed = cls.id.charCodeAt(cls.id.length - 1)
    if (clsSeed % 3 === 0) {
      attendance.push({
        id: `att-${idx++}`,
        class_id: cls.id,
        member_id: 'member-8',
        checked_in: true,
        walk_in: true,
      })
    }
  }
  return attendance
}

export const demoAttendance: DemoAttendance[] = generateAttendance()

export const demoClassFeedPosts = [
  {
    id: 'cfp-1',
    class_id: demoClasses[0]?.id ?? 'cls-unknown',
    author: demoClasses[0]?.teacher.name ?? 'Alex',
    author_id: demoClasses[0]?.teacher_id ?? TEACHER_EMMA_ID,
    content: 'Great energy in class today! Everyone really pushed through that combo sequence.',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    media_urls: [
      'https://images.unsplash.com/photo-1589710751893-f9a6770ad71b?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '🔥', count: 4 }, { emoji: '💪', count: 3 }],
  },
  {
    id: 'cfp-2',
    class_id: demoClasses[0]?.id ?? 'cls-unknown',
    author: 'Kai',
    author_id: 'member-2',
    content: 'Finally got that spin transition! Thanks for the tip about hand placement.',
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    media_urls: [],
    reactions: [{ emoji: '🎉', count: 5 }],
  },
  {
    id: 'cfp-3',
    class_id: demoClasses[1]?.id ?? 'cls-unknown',
    author: demoClasses[1]?.teacher.name ?? 'Jade',
    author_id: demoClasses[1]?.teacher_id ?? TEACHER_JADE_ID,
    content: 'Photos from tonight are up! Check the shared album link in your booking confirmation email.',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    media_urls: [
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop',
      'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '📸', count: 7 }, { emoji: '❤️', count: 6 }],
  },
  {
    id: 'cfp-4',
    class_id: demoClasses[2]?.id ?? 'cls-unknown',
    author: 'Mia',
    author_id: 'member-3',
    content: 'That conditioning circuit was no joke. My arms are going to be sore tomorrow.',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    media_urls: [],
    reactions: [{ emoji: '😂', count: 8 }, { emoji: '💪', count: 2 }],
  },
  {
    id: 'cfp-5',
    class_id: demoClasses[1]?.id ?? 'cls-unknown',
    author: 'Jordan',
    author_id: 'member-5',
    content: 'Second class ever and I already feel like I belong here. This community is amazing.',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    media_urls: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop',
    ],
    reactions: [{ emoji: '❤️', count: 11 }, { emoji: '🥰', count: 4 }],
  },
]

export interface DemoPrivateBooking {
  id: string
  studio_id: string
  client_name: string
  client_email: string
  type: string
  date: string
  start_time: string
  end_time: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  notes: string
  price_cents: number
  currency: string
}

export const demoPrivateBookings: DemoPrivateBooking[] = [
  {
    id: 'pb-1',
    studio_id: STUDIO_ID,
    client_name: 'Sarah Chen',
    client_email: 'sarah@example.com',
    type: 'Private Lesson',
    date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    start_time: '14:00:00',
    end_time: '15:00:00',
    status: 'confirmed',
    notes: 'Pole Level 2 catch-up — missed last two weeks. Focus on inverts.',
    price_cents: 8500,
    currency: 'NZD',
  },
  {
    id: 'pb-2',
    studio_id: STUDIO_ID,
    client_name: 'Tina & Friends',
    client_email: 'tina@example.com',
    type: 'Pole Party',
    date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    start_time: '18:00:00',
    end_time: '20:00:00',
    status: 'pending',
    notes: 'Hen party for 8 people. Beginner-friendly, fun focus. Bring own drinks.',
    price_cents: 40000,
    currency: 'NZD',
  },
  {
    id: 'pb-3',
    studio_id: STUDIO_ID,
    client_name: 'WellCo Ltd',
    client_email: 'events@wellco.nz',
    type: 'Corporate Event',
    date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    start_time: '10:00:00',
    end_time: '12:00:00',
    status: 'pending',
    notes: 'Team building for 15 staff. Mix of aerial hoop and flexibility. Catering TBD.',
    price_cents: 75000,
    currency: 'NZD',
  },
  {
    id: 'pb-4',
    studio_id: STUDIO_ID,
    client_name: 'Lena Park',
    client_email: 'lena@example.com',
    type: 'Private Lesson',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    start_time: '16:00:00',
    end_time: '17:00:00',
    status: 'completed',
    notes: 'Aerial silks intro — worked on basic climbs and foot locks.',
    price_cents: 8500,
    currency: 'NZD',
  },
  {
    id: 'pb-5',
    studio_id: STUDIO_ID,
    client_name: 'Mike Torres',
    client_email: 'mike@example.com',
    type: 'Private Lesson',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!,
    start_time: '11:00:00',
    end_time: '12:00:00',
    status: 'cancelled',
    notes: 'Handbalance session — cancelled due to injury.',
    price_cents: 8500,
    currency: 'NZD',
  },
]

export const demoReportsData = {
  summary: {
    monthlyRevenue: 12450,
    activeMembers: 48,
    avgAttendance: 8.3,
    retentionRate: 87,
  },
  weeklyAttendance: [
    { week: 'Week 1', checkins: 62 },
    { week: 'Week 2', checkins: 71 },
    { week: 'Week 3', checkins: 58 },
    { week: 'Week 4', checkins: 75 },
    { week: 'Week 5', checkins: 68 },
    { week: 'Week 6', checkins: 82 },
    { week: 'Week 7', checkins: 77 },
    { week: 'Week 8', checkins: 85 },
  ],
  monthlyRevenue: [
    { month: 'Sep', memberships: 7200, dropIns: 1250, packs: 3200 },
    { month: 'Oct', memberships: 7900, dropIns: 1400, packs: 2800 },
    { month: 'Nov', memberships: 8600, dropIns: 1100, packs: 3600 },
    { month: 'Dec', memberships: 7400, dropIns: 900, packs: 2200 },
    { month: 'Jan', memberships: 9200, dropIns: 1800, packs: 4100 },
    { month: 'Feb', memberships: 9800, dropIns: 1650, packs: 4000 },
  ],
  popularClasses: [
    { name: 'Pole Technique Level 1', fillRate: 92, avgAttendance: 11 },
    { name: 'Flexibility & Conditioning', fillRate: 88, avgAttendance: 14 },
    { name: 'Pole Flow & Floorwork', fillRate: 85, avgAttendance: 12 },
    { name: 'Aerial Hoop (Lyra)', fillRate: 81, avgAttendance: 6.5 },
    { name: 'Pole Technique Level 2', fillRate: 78, avgAttendance: 7.8 },
  ],
  retention: {
    monthly: [
      { month: 'Sep', rate: 82 },
      { month: 'Oct', rate: 84 },
      { month: 'Nov', rate: 86 },
      { month: 'Dec', rate: 79 },
      { month: 'Jan', rate: 88 },
      { month: 'Feb', rate: 87 },
    ],
    avgClassesPerMember: 3.2,
    atRiskMembers: [
      { name: 'Jordan', lastClass: '3 weeks ago', totalClasses: 4 },
      { name: 'Riley', lastClass: '2 weeks ago', totalClasses: 6 },
    ],
  },
}

// ============================================================
// V4: Member Stats & Attendance Analytics
// ============================================================

export interface DemoMemberStats {
  memberId: string
  totalClasses: number
  thisMonth: number
  currentStreak: number
  longestStreak: number
  favoriteClass: string
  favoriteTeacher: string
  classBreakdown: { className: string; count: number }[]
  monthlyHistory: { month: string; classes: number }[]
}

export const demoMemberStats: DemoMemberStats[] = [
  {
    memberId: 'member-1',
    totalClasses: 32,
    thisMonth: 6,
    currentStreak: 3,
    longestStreak: 5,
    favoriteClass: 'Pole Technique Level 2',
    favoriteTeacher: 'Alex',
    classBreakdown: [
      { className: 'Pole Technique Level 2', count: 12 },
      { className: 'Flexibility & Conditioning', count: 8 },
      { className: 'Pole Flow & Floorwork', count: 6 },
      { className: 'Aerial Hoop (Lyra)', count: 4 },
      { className: 'Open Practice', count: 2 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 4 }, { month: 'Oct', classes: 5 },
      { month: 'Nov', classes: 6 }, { month: 'Dec', classes: 3 },
      { month: 'Jan', classes: 8 }, { month: 'Feb', classes: 6 },
    ],
  },
  {
    memberId: 'member-2',
    totalClasses: 18,
    thisMonth: 4,
    currentStreak: 2,
    longestStreak: 3,
    favoriteClass: 'Aerial Hoop (Lyra)',
    favoriteTeacher: 'Jade',
    classBreakdown: [
      { className: 'Aerial Hoop (Lyra)', count: 8 },
      { className: 'Pole Technique Level 1', count: 6 },
      { className: 'Flexibility & Conditioning', count: 4 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 2 }, { month: 'Oct', classes: 3 },
      { month: 'Nov', classes: 3 }, { month: 'Dec', classes: 2 },
      { month: 'Jan', classes: 4 }, { month: 'Feb', classes: 4 },
    ],
  },
  {
    memberId: 'member-3',
    totalClasses: 52,
    thisMonth: 8,
    currentStreak: 6,
    longestStreak: 8,
    favoriteClass: 'Pole Technique Level 2',
    favoriteTeacher: 'Alex',
    classBreakdown: [
      { className: 'Pole Technique Level 2', count: 16 },
      { className: 'Pole Flow & Floorwork', count: 12 },
      { className: 'Flexibility & Conditioning', count: 10 },
      { className: 'Aerial Silks', count: 8 },
      { className: 'Open Practice', count: 6 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 7 }, { month: 'Oct', classes: 9 },
      { month: 'Nov', classes: 8 }, { month: 'Dec', classes: 6 },
      { month: 'Jan', classes: 10 }, { month: 'Feb', classes: 8 },
    ],
  },
  {
    memberId: 'member-4',
    totalClasses: 12,
    thisMonth: 3,
    currentStreak: 1,
    longestStreak: 2,
    favoriteClass: 'Pole Technique Level 1',
    favoriteTeacher: 'Sam',
    classBreakdown: [
      { className: 'Pole Technique Level 1', count: 6 },
      { className: 'Flexibility & Conditioning', count: 4 },
      { className: 'Hula Hoop', count: 2 },
    ],
    monthlyHistory: [
      { month: 'Nov', classes: 2 }, { month: 'Dec', classes: 3 },
      { month: 'Jan', classes: 4 }, { month: 'Feb', classes: 3 },
    ],
  },
  {
    memberId: 'member-5',
    totalClasses: 4,
    thisMonth: 2,
    currentStreak: 1,
    longestStreak: 1,
    favoriteClass: 'Pole Technique Level 1',
    favoriteTeacher: 'Aria',
    classBreakdown: [
      { className: 'Pole Technique Level 1', count: 3 },
      { className: 'Flexibility & Conditioning', count: 1 },
    ],
    monthlyHistory: [
      { month: 'Jan', classes: 2 }, { month: 'Feb', classes: 2 },
    ],
  },
  {
    memberId: 'member-6',
    totalClasses: 28,
    thisMonth: 5,
    currentStreak: 4,
    longestStreak: 6,
    favoriteClass: 'Aerial Silks',
    favoriteTeacher: 'Jade',
    classBreakdown: [
      { className: 'Aerial Silks', count: 10 },
      { className: 'Aerial Hoop (Lyra)', count: 8 },
      { className: 'Flexibility & Conditioning', count: 6 },
      { className: 'Open Practice', count: 4 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 4 }, { month: 'Oct', classes: 5 },
      { month: 'Nov', classes: 5 }, { month: 'Dec', classes: 3 },
      { month: 'Jan', classes: 6 }, { month: 'Feb', classes: 5 },
    ],
  },
  {
    memberId: 'member-7',
    totalClasses: 22,
    thisMonth: 4,
    currentStreak: 2,
    longestStreak: 4,
    favoriteClass: 'Handbalance',
    favoriteTeacher: 'Sam',
    classBreakdown: [
      { className: 'Handbalance', count: 9 },
      { className: 'Flexibility & Conditioning', count: 6 },
      { className: 'Open Practice', count: 5 },
      { className: 'Pole Technique Level 1', count: 2 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 3 }, { month: 'Oct', classes: 4 },
      { month: 'Nov', classes: 4 }, { month: 'Dec', classes: 2 },
      { month: 'Jan', classes: 5 }, { month: 'Feb', classes: 4 },
    ],
  },
  {
    memberId: 'member-8',
    totalClasses: 15,
    thisMonth: 3,
    currentStreak: 2,
    longestStreak: 3,
    favoriteClass: 'Handbalance',
    favoriteTeacher: 'Sam',
    classBreakdown: [
      { className: 'Handbalance', count: 7 },
      { className: 'Pole Flow & Floorwork', count: 4 },
      { className: 'Open Practice', count: 4 },
    ],
    monthlyHistory: [
      { month: 'Oct', classes: 2 }, { month: 'Nov', classes: 3 },
      { month: 'Dec', classes: 2 }, { month: 'Jan', classes: 5 },
      { month: 'Feb', classes: 3 },
    ],
  },
  // Teacher stats
  {
    memberId: TEACHER_EMMA_ID,
    totalClasses: 210,
    thisMonth: 18,
    currentStreak: 12,
    longestStreak: 24,
    favoriteClass: 'Pole Technique Level 2',
    favoriteTeacher: 'Self',
    classBreakdown: [
      { className: 'Pole Technique Level 2', count: 85 },
      { className: 'Pole Technique Level 3', count: 60 },
      { className: 'Pole Flow & Floorwork', count: 40 },
      { className: 'Open Practice', count: 25 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 16 }, { month: 'Oct', classes: 18 },
      { month: 'Nov', classes: 17 }, { month: 'Dec', classes: 14 },
      { month: 'Jan', classes: 19 }, { month: 'Feb', classes: 18 },
    ],
  },
  {
    memberId: TEACHER_JADE_ID,
    totalClasses: 180,
    thisMonth: 15,
    currentStreak: 10,
    longestStreak: 20,
    favoriteClass: 'Aerial Hoop (Lyra)',
    favoriteTeacher: 'Self',
    classBreakdown: [
      { className: 'Aerial Hoop (Lyra)', count: 72 },
      { className: 'Aerial Silks', count: 55 },
      { className: 'Open Practice', count: 35 },
      { className: 'Flexibility & Conditioning', count: 18 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 14 }, { month: 'Oct', classes: 15 },
      { month: 'Nov', classes: 16 }, { month: 'Dec', classes: 12 },
      { month: 'Jan', classes: 16 }, { month: 'Feb', classes: 15 },
    ],
  },
  {
    memberId: TEACHER_SAM_ID,
    totalClasses: 150,
    thisMonth: 12,
    currentStreak: 8,
    longestStreak: 16,
    favoriteClass: 'Flexibility & Conditioning',
    favoriteTeacher: 'Self',
    classBreakdown: [
      { className: 'Flexibility & Conditioning', count: 65 },
      { className: 'Handbalance', count: 45 },
      { className: 'Pole Technique Level 1', count: 25 },
      { className: 'Open Practice', count: 15 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 11 }, { month: 'Oct', classes: 12 },
      { month: 'Nov', classes: 13 }, { month: 'Dec', classes: 10 },
      { month: 'Jan', classes: 14 }, { month: 'Feb', classes: 12 },
    ],
  },
  {
    memberId: TEACHER_ARIA_ID,
    totalClasses: 120,
    thisMonth: 10,
    currentStreak: 6,
    longestStreak: 14,
    favoriteClass: 'Aerial Hoop (Lyra)',
    favoriteTeacher: 'Self',
    classBreakdown: [
      { className: 'Aerial Hoop (Lyra)', count: 50 },
      { className: 'Aerial Silks', count: 35 },
      { className: 'Flexibility & Conditioning', count: 20 },
      { className: 'Open Practice', count: 15 },
    ],
    monthlyHistory: [
      { month: 'Sep', classes: 9 }, { month: 'Oct', classes: 10 },
      { month: 'Nov', classes: 11 }, { month: 'Dec', classes: 8 },
      { month: 'Jan', classes: 12 }, { month: 'Feb', classes: 10 },
    ],
  },
]

export function getDemoMemberStats(memberId: string): DemoMemberStats | undefined {
  return demoMemberStats.find((s) => s.memberId === memberId)
}

// ============================================================
// V5: Badges & Achievements
// ============================================================

export interface DemoBadge {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  category: 'classes' | 'streaks' | 'community'
  threshold?: number
}

export const demoBadges: DemoBadge[] = [
  { id: 'badge-1', slug: 'first-step', name: 'First Step', description: 'Attended your first class', icon: '👣', category: 'classes', threshold: 1 },
  { id: 'badge-2', slug: 'regular', name: 'Regular', description: 'Attended 10 classes', icon: '⭐', category: 'classes', threshold: 10 },
  { id: 'badge-3', slug: 'dedicated', name: 'Dedicated', description: 'Attended 25 classes', icon: '💎', category: 'classes', threshold: 25 },
  { id: 'badge-4', slug: 'half-century', name: 'Half Century', description: 'Attended 50 classes', icon: '🏅', category: 'classes', threshold: 50 },
  { id: 'badge-5', slug: 'centurion', name: 'Centurion', description: 'Attended 100 classes', icon: '🏆', category: 'classes', threshold: 100 },
  { id: 'badge-6', slug: 'on-fire', name: 'On Fire', description: 'Maintained a 4-week attendance streak', icon: '🔥', category: 'streaks' },
  { id: 'badge-7', slug: 'community-voice', name: 'Community Voice', description: 'Made your first feed post', icon: '💬', category: 'community' },
  { id: 'badge-8', slug: 'cheerleader', name: 'Cheerleader', description: 'Reacted to your first post', icon: '🎉', category: 'community' },
]

export interface DemoMemberBadge {
  memberId: string
  badgeId: string
  earnedAt: string
}

export const demoMemberBadges: DemoMemberBadge[] = [
  // Mia (member-3) — 52 classes, longest streak 8
  { memberId: 'member-3', badgeId: 'badge-1', earnedAt: '2025-03-12T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-2', earnedAt: '2025-05-20T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-3', earnedAt: '2025-08-15T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-4', earnedAt: '2025-12-10T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-6', earnedAt: '2025-06-01T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-7', earnedAt: '2025-04-02T10:00:00Z' },
  { memberId: 'member-3', badgeId: 'badge-8', earnedAt: '2025-03-15T10:00:00Z' },
  // Rabble (member-1) — 32 classes
  { memberId: 'member-1', badgeId: 'badge-1', earnedAt: '2025-06-05T10:00:00Z' },
  { memberId: 'member-1', badgeId: 'badge-2', earnedAt: '2025-08-10T10:00:00Z' },
  { memberId: 'member-1', badgeId: 'badge-3', earnedAt: '2025-11-22T10:00:00Z' },
  { memberId: 'member-1', badgeId: 'badge-7', earnedAt: '2025-07-01T10:00:00Z' },
  { memberId: 'member-1', badgeId: 'badge-8', earnedAt: '2025-06-08T10:00:00Z' },
  // Riley (member-6) — 28 classes, streak 6
  { memberId: 'member-6', badgeId: 'badge-1', earnedAt: '2024-12-10T10:00:00Z' },
  { memberId: 'member-6', badgeId: 'badge-2', earnedAt: '2025-03-05T10:00:00Z' },
  { memberId: 'member-6', badgeId: 'badge-3', earnedAt: '2025-07-20T10:00:00Z' },
  { memberId: 'member-6', badgeId: 'badge-6', earnedAt: '2025-05-15T10:00:00Z' },
  { memberId: 'member-6', badgeId: 'badge-8', earnedAt: '2025-01-05T10:00:00Z' },
  // Quinn (member-7) — 22 classes
  { memberId: 'member-7', badgeId: 'badge-1', earnedAt: '2025-01-25T10:00:00Z' },
  { memberId: 'member-7', badgeId: 'badge-2', earnedAt: '2025-04-18T10:00:00Z' },
  { memberId: 'member-7', badgeId: 'badge-7', earnedAt: '2025-03-10T10:00:00Z' },
  // Kai (member-2) — 18 classes
  { memberId: 'member-2', badgeId: 'badge-1', earnedAt: '2025-07-20T10:00:00Z' },
  { memberId: 'member-2', badgeId: 'badge-2', earnedAt: '2025-10-15T10:00:00Z' },
  { memberId: 'member-2', badgeId: 'badge-8', earnedAt: '2025-08-01T10:00:00Z' },
  // Avery (member-8) — 15 classes
  { memberId: 'member-8', badgeId: 'badge-1', earnedAt: '2025-04-22T10:00:00Z' },
  { memberId: 'member-8', badgeId: 'badge-2', earnedAt: '2025-09-05T10:00:00Z' },
  { memberId: 'member-8', badgeId: 'badge-7', earnedAt: '2025-06-15T10:00:00Z' },
  // Alex (member-4) — 12 classes
  { memberId: 'member-4', badgeId: 'badge-1', earnedAt: '2025-09-25T10:00:00Z' },
  { memberId: 'member-4', badgeId: 'badge-2', earnedAt: '2025-12-18T10:00:00Z' },
  // Jordan (member-5) — 4 classes
  { memberId: 'member-5', badgeId: 'badge-1', earnedAt: '2025-11-05T10:00:00Z' },
  // Teacher Alex (owner) — 210 classes
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-1', earnedAt: '2024-01-20T10:00:00Z' },
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-2', earnedAt: '2024-02-15T10:00:00Z' },
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-3', earnedAt: '2024-03-20T10:00:00Z' },
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-4', earnedAt: '2024-05-10T10:00:00Z' },
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-5', earnedAt: '2024-08-15T10:00:00Z' },
  { memberId: TEACHER_EMMA_ID, badgeId: 'badge-6', earnedAt: '2024-04-01T10:00:00Z' },
  // Teacher Jade — 180 classes
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-1', earnedAt: '2024-02-05T10:00:00Z' },
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-2', earnedAt: '2024-03-10T10:00:00Z' },
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-3', earnedAt: '2024-04-15T10:00:00Z' },
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-4', earnedAt: '2024-06-20T10:00:00Z' },
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-5', earnedAt: '2024-10-01T10:00:00Z' },
  { memberId: TEACHER_JADE_ID, badgeId: 'badge-6', earnedAt: '2024-05-01T10:00:00Z' },
  // Teacher Sam — 150 classes
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-1', earnedAt: '2024-03-15T10:00:00Z' },
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-2', earnedAt: '2024-04-20T10:00:00Z' },
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-3', earnedAt: '2024-06-01T10:00:00Z' },
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-4', earnedAt: '2024-08-10T10:00:00Z' },
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-5', earnedAt: '2024-12-15T10:00:00Z' },
  { memberId: TEACHER_SAM_ID, badgeId: 'badge-6', earnedAt: '2024-07-01T10:00:00Z' },
  // Teacher Aria — 120 classes
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-1', earnedAt: '2024-06-05T10:00:00Z' },
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-2', earnedAt: '2024-07-15T10:00:00Z' },
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-3', earnedAt: '2024-09-01T10:00:00Z' },
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-4', earnedAt: '2024-11-20T10:00:00Z' },
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-5', earnedAt: '2025-03-01T10:00:00Z' },
  { memberId: TEACHER_ARIA_ID, badgeId: 'badge-6', earnedAt: '2024-10-01T10:00:00Z' },
]

export function getDemoMemberBadges(memberId: string) {
  return demoMemberBadges
    .filter((mb) => mb.memberId === memberId)
    .map((mb) => ({
      ...mb,
      badge: demoBadges.find((b) => b.id === mb.badgeId)!,
    }))
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
}

// ============================================================
// V6: Notifications
// ============================================================

export interface DemoNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, string> | null
  sent_at: string
  read_at: string | null
  studio_id: string
}

export const notificationTypeIcons: Record<string, string> = {
  booking_confirmed: '✅',
  class_reminder_24h: '📅',
  feed_milestone: '🏆',
  waitlist_promoted: '🎉',
  class_cancelled: '❌',
  payment_received: '💳',
  reengagement: '👋',
  new_achievement: '🏅',
}

export const demoNotifications: DemoNotification[] = [
  {
    id: 'notif-1',
    type: 'booking_confirmed',
    title: 'Booking Confirmed',
    body: 'You\'re booked into Pole Technique Level 2 tomorrow at 6:45 PM.',
    data: { class_id: demoClasses[0]?.id ?? '' },
    sent_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-2',
    type: 'class_reminder_24h',
    title: 'Class Tomorrow',
    body: 'Reminder: Flexibility & Conditioning is tomorrow at 5:30 PM. See you there!',
    data: null,
    sent_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-3',
    type: 'new_achievement',
    title: 'New Badge Earned!',
    body: 'Congratulations! You\'ve earned the "Dedicated" badge for attending 25 classes.',
    data: { badge_id: 'badge-3' },
    sent_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-4',
    type: 'waitlist_promoted',
    title: 'You\'re In!',
    body: 'A spot opened up in Aerial Hoop (Lyra) on Saturday. You\'ve been moved off the waitlist!',
    data: null,
    sent_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-5',
    type: 'feed_milestone',
    title: 'Milestone Celebration',
    body: 'Mia just hit 50 classes! Join the community in congratulating them.',
    data: { post_id: 'post-5' },
    sent_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-6',
    type: 'payment_received',
    title: 'Payment Received',
    body: 'Your Unlimited Monthly plan has renewed — $180.00 NZD charged.',
    data: null,
    sent_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(),
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-7',
    type: 'class_cancelled',
    title: 'Class Cancelled',
    body: 'Pole Technique Level 3 on Thursday has been cancelled. Your booking has been refunded.',
    data: null,
    sent_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    read_at: new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(),
    studio_id: STUDIO_ID,
  },
  {
    id: 'notif-8',
    type: 'reengagement',
    title: 'We Miss You!',
    body: 'It\'s been a while since your last class. Book now and keep your streak going!',
    data: null,
    sent_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
    read_at: null,
    studio_id: STUDIO_ID,
  },
]

export function getDemoUnreadCount() {
  return demoNotifications.filter((n) => n.read_at === null).length
}

// ============================================================
// V7: Multi-Studio Network
// ============================================================

export const demoNetworks = [
  {
    id: 'network-1',
    name: 'Wellington Movement Collective',
    description: 'A network of independent movement studios across Wellington, offering cross-booking benefits to members. Train at any partner studio with your home membership.',
    created_at: '2025-06-01T00:00:00Z',
  },
]

export interface DemoNetworkMember {
  studioId: string
  studioName: string
  discipline: string
  crossBookingPolicy: 'included' | 'discounted' | 'full_price'
  discountPercent: number
  memberCount: number
}

export const demoNetworkMembers: DemoNetworkMember[] = [
  { studioId: STUDIO_ID, studioName: 'Empire Aerial Arts', discipline: 'Pole & Aerial', crossBookingPolicy: 'included', discountPercent: 0, memberCount: 48 },
  { studioId: 'studio-yoga', studioName: 'Wellington Yoga Collective', discipline: 'Yoga', crossBookingPolicy: 'included', discountPercent: 0, memberCount: 92 },
  { studioId: 'studio-crossfit', studioName: 'CrossFit Cuba St', discipline: 'CrossFit', crossBookingPolicy: 'discounted', discountPercent: 25, memberCount: 85 },
  { studioId: 'studio-dance', studioName: 'Dance Central', discipline: 'Dance', crossBookingPolicy: 'discounted', discountPercent: 20, memberCount: 64 },
  { studioId: 'studio-barre', studioName: 'Barre & Beyond', discipline: 'Barre', crossBookingPolicy: 'full_price', discountPercent: 0, memberCount: 58 },
]

export const demoNetworkStats = {
  totalStudios: 5,
  totalMembers: 347,
  crossBookingsThisMonth: 23,
  networkRevenue: 1850,
}

// ============================================================
// Helper functions
// ============================================================

export function getDemoClassById(classId: string): DemoClass | undefined {
  return demoClasses.find((c) => c.id === classId)
}

export function getDemoMemberById(memberId: string) {
  return demoMembers.find((m) => m.id === memberId)
}

export function getDemoBookingsForClass(classId: string) {
  return demoBookings
    .filter((b) => b.class_id === classId)
    .map((b) => ({
      ...b,
      member: demoMembers.find((m) => m.id === b.member_id),
    }))
}

export function getDemoClassesForMember(memberId: string) {
  const memberBookings = demoBookings.filter((b) => b.member_id === memberId)
  return memberBookings
    .map((b) => ({
      ...b,
      class: demoClasses.find((c) => c.id === b.class_id),
    }))
    .filter((b) => b.class != null)
}

export function getDemoAttendanceForClass(classId: string) {
  return demoAttendance.filter((a) => a.class_id === classId)
}

export function getDemoClassFeedPosts(classId: string) {
  return demoClassFeedPosts.filter((p) => p.class_id === classId)
}
