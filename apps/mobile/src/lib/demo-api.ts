import { DEMO_STUDIO_ID, DEMO_STUDIO_SLUG, DemoRole, getDemoIdentity } from './demo-mode'

type RequestOpts = { method?: string; body?: unknown }

type DemoClass = {
  id: string
  studio_id: string
  date: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'in_progress' | 'completed'
  max_capacity: number
  booking_count: number
  feed_enabled: boolean
  notes: string | null
  template: { id: string; name: string; description: string | null } | null
  teacher: { id: string; name: string; avatar_url: string | null } | null
}

type DemoBookingRecord = {
  id: string
  class_id: string
  user_id: string
  status: 'booked' | 'waitlisted' | 'cancelled'
}

type DemoReaction = {
  emoji: string
  count: number
  reacted: boolean
}

type DemoFeedPost = {
  id: string
  content: string | null
  post_type: 'text' | 'photo' | 'video' | 'milestone'
  media_urls: string[]
  created_at: string
  user: { id: string; name: string; avatar_url: string | null }
  class_name: string | null
  reactions: DemoReaction[]
}

type DemoNotification = {
  id: string
  type: string
  title: string
  body: string
  sent_at: string
  read_at: string | null
}

type DemoRosterEntry = {
  user_id: string
  name: string
  avatar_url: string | null
  booking_id: string | null
  booking_status: string | null
  spot: string | null
  checked_in: boolean
  walk_in: boolean
  notes: string | null
}

type DemoSubscription = {
  id: string
  plan_name: string
  status: string
  current_period_end: string
  cancel_at_period_end: boolean
}

type DemoClassPass = {
  id: string
  name: string
  remaining: number
  total: number
  expires_at: string | null
}

type DemoCompCredit = {
  id: string
  reason: string
  remaining: number
  expires_at: string | null
}

type DemoState = {
  classes: DemoClass[]
  bookings: DemoBookingRecord[]
  feedPosts: DemoFeedPost[]
  notifications: DemoNotification[]
  rosterByClassId: Record<string, DemoRosterEntry[]>
  subscription: DemoSubscription | null
  classPasses: DemoClassPass[]
  compCredits: DemoCompCredit[]
  profile: {
    name: string
    email: string
    total_classes: number
    this_month: number
    streak: number
    member_since: string
  }
  attendance: Array<{ date: string; class_name: string; checked_in: boolean }>
  calendarTokens: Array<{ id: string; label: string; created_at: string; last_used_at: string | null }>
}

const stateByRole: Partial<Record<DemoRole, DemoState>> = {}

const DEMO_STUDIO = {
  id: DEMO_STUDIO_ID,
  name: 'Empire Aerial Arts',
  slug: DEMO_STUDIO_SLUG,
  discipline: 'aerial',
  description: 'Wellington’s pole and aerial studio with a strong community-first culture.',
  logo_url: null,
  address: '183 Cuba Street, Wellington',
  phone: '+64 4 555 0101',
  website: 'https://studio.coop',
  email: 'hello@empireaerialarts.com',
  instagram: 'https://www.instagram.com/empireaerialarts/',
  facebook: 'https://facebook.com/empireaerialarts',
  city: 'Wellington',
  country_code: 'NZ',
  region: 'Wellington',
  latitude: -41.2924,
  longitude: 174.7787,
} as const

const DEMO_PLANS = [
  {
    id: 'demo-plan-unlimited',
    name: 'Unlimited Membership',
    description: 'Unlimited classes each month.',
    type: 'unlimited',
    price_cents: 16900,
    currency: 'NZD',
    interval: 'month',
    class_limit: null,
    validity_days: null,
    stripe_price_id: 'price_demo_unlimited',
    active: true,
    sort_order: 1,
  },
  {
    id: 'demo-plan-pack-10',
    name: '10 Class Pack',
    description: 'Great for flexible schedules.',
    type: 'class_pack',
    price_cents: 13900,
    currency: 'NZD',
    interval: 'once',
    class_limit: 10,
    validity_days: 60,
    stripe_price_id: 'price_demo_pack10',
    active: true,
    sort_order: 2,
  },
]

const DEFAULT_REACTIONS = [
  { emoji: '❤️', count: 3, reacted: false },
  { emoji: '🔥', count: 2, reacted: false },
  { emoji: '👏', count: 5, reacted: false },
]

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function formatLocalDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function datePlus(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

function isoAt(date: string, time: string) {
  return `${date}T${time}:00.000Z`
}

function createInitialClasses(): DemoClass[] {
  return [
    {
      id: 'demo-class-001',
      studio_id: DEMO_STUDIO_ID,
      date: datePlus(0),
      start_time: '09:00',
      end_time: '10:00',
      status: 'scheduled',
      max_capacity: 12,
      booking_count: 7,
      feed_enabled: true,
      notes: null,
      template: {
        id: 'demo-template-001',
        name: 'Intro Pole',
        description: 'A beginner-friendly class focused on confidence and core movement.',
      },
      teacher: {
        id: 'demo-teacher-001',
        name: 'Jade Teacher',
        avatar_url: null,
      },
    },
    {
      id: 'demo-class-002',
      studio_id: DEMO_STUDIO_ID,
      date: datePlus(0),
      start_time: '18:00',
      end_time: '19:00',
      status: 'scheduled',
      max_capacity: 10,
      booking_count: 8,
      feed_enabled: true,
      notes: null,
      template: {
        id: 'demo-template-002',
        name: 'Aerial Hoop Flow',
        description: 'Technique + conditioning with progressive options.',
      },
      teacher: {
        id: 'demo-teacher-002',
        name: 'Nina Coach',
        avatar_url: null,
      },
    },
    {
      id: 'demo-class-003',
      studio_id: DEMO_STUDIO_ID,
      date: datePlus(1),
      start_time: '17:30',
      end_time: '18:30',
      status: 'scheduled',
      max_capacity: 14,
      booking_count: 6,
      feed_enabled: true,
      notes: null,
      template: {
        id: 'demo-template-003',
        name: 'Strength & Flex',
        description: 'Accessory strength for aerial and pole students.',
      },
      teacher: {
        id: 'demo-teacher-001',
        name: 'Jade Teacher',
        avatar_url: null,
      },
    },
    {
      id: 'demo-class-004',
      studio_id: DEMO_STUDIO_ID,
      date: datePlus(2),
      start_time: '19:00',
      end_time: '20:00',
      status: 'scheduled',
      max_capacity: 12,
      booking_count: 4,
      feed_enabled: true,
      notes: null,
      template: {
        id: 'demo-template-004',
        name: 'Open Practice',
        description: 'Supervised self-directed session.',
      },
      teacher: {
        id: 'demo-teacher-001',
        name: 'Jade Teacher',
        avatar_url: null,
      },
    },
  ]
}

function createInitialState(role: DemoRole): DemoState {
  const me = getDemoIdentity(role)
  const classes = createInitialClasses()
  const today = datePlus(0)

  const baseFeed: DemoFeedPost[] = [
    {
      id: 'demo-feed-001',
      content: 'Loved tonight’s hoop class. Feeling stronger each week.',
      post_type: 'text',
      media_urls: [],
      created_at: isoAt(today, '10:30'),
      user: { id: 'demo-member-ana', name: 'Ana', avatar_url: null },
      class_name: 'Aerial Hoop Flow',
      reactions: clone(DEFAULT_REACTIONS),
    },
    {
      id: 'demo-feed-002',
      content: 'First invert unlocked!',
      post_type: 'milestone',
      media_urls: [],
      created_at: isoAt(today, '08:15'),
      user: { id: 'demo-member-bea', name: 'Bea', avatar_url: null },
      class_name: 'Intro Pole',
      reactions: clone(DEFAULT_REACTIONS),
    },
  ]

  const notifications: DemoNotification[] = [
    {
      id: 'demo-notif-001',
      type: 'booking_confirmed',
      title: 'Booking confirmed',
      body: 'You are booked for Intro Pole at 9:00 AM.',
      sent_at: isoAt(today, '07:00'),
      read_at: null,
    },
    {
      id: 'demo-notif-002',
      type: 'class_reminder_24h',
      title: 'Class reminder',
      body: 'Aerial Hoop Flow starts tomorrow at 6:00 PM.',
      sent_at: isoAt(datePlus(-1), '18:00'),
      read_at: role === 'student' ? null : isoAt(today, '06:45'),
    },
  ]

  const rosterByClassId: Record<string, DemoRosterEntry[]> = {
    'demo-class-001': [
      {
        user_id: 'demo-member-ana',
        name: 'Ana',
        avatar_url: null,
        booking_id: 'demo-booking-ana-001',
        booking_status: 'booked',
        spot: '1',
        checked_in: true,
        walk_in: false,
        notes: null,
      },
      {
        user_id: me.id,
        name: me.name,
        avatar_url: null,
        booking_id: `demo-booking-self-${role}-001`,
        booking_status: 'booked',
        spot: '2',
        checked_in: role !== 'student',
        walk_in: false,
        notes: null,
      },
      {
        user_id: 'demo-member-bea',
        name: 'Bea',
        avatar_url: null,
        booking_id: 'demo-booking-bea-001',
        booking_status: 'booked',
        spot: '3',
        checked_in: false,
        walk_in: false,
        notes: null,
      },
    ],
    'demo-class-002': [
      {
        user_id: 'demo-member-kai',
        name: 'Kai',
        avatar_url: null,
        booking_id: 'demo-booking-kai-002',
        booking_status: 'booked',
        spot: '1',
        checked_in: false,
        walk_in: false,
        notes: null,
      },
    ],
  }

  const bookings: DemoBookingRecord[] = role === 'student'
    ? [{ id: `demo-booking-self-${role}-001`, class_id: 'demo-class-001', user_id: me.id, status: 'booked' }]
    : role === 'teacher'
      ? [{ id: `demo-booking-self-${role}-001`, class_id: 'demo-class-004', user_id: me.id, status: 'booked' }]
      : [{ id: `demo-booking-self-${role}-001`, class_id: 'demo-class-003', user_id: me.id, status: 'booked' }]

  const subscription: DemoSubscription | null = role === 'student'
    ? {
      id: 'demo-subscription-001',
      plan_name: 'Unlimited Membership',
      status: 'active',
      current_period_end: isoAt(datePlus(28), '00:00'),
      cancel_at_period_end: false,
    }
    : null

  const classPasses: DemoClassPass[] = role === 'student'
    ? []
    : role === 'teacher'
      ? [
        {
          id: 'demo-pass-teacher-001',
          name: 'Staff Training Pack',
          remaining: 4,
          total: 8,
          expires_at: isoAt(datePlus(45), '00:00'),
        },
      ]
      : [
        {
          id: 'demo-pass-owner-001',
          name: 'Owner Comp Classes',
          remaining: 6,
          total: 10,
          expires_at: isoAt(datePlus(60), '00:00'),
        },
      ]

  const compCredits: DemoCompCredit[] = role === 'student'
    ? [
      {
        id: 'demo-comp-001',
        reason: 'Referral thank-you',
        remaining: 1,
        expires_at: isoAt(datePlus(30), '00:00'),
      },
    ]
    : []

  const profile = role === 'owner'
    ? {
      name: me.name,
      email: me.email,
      total_classes: 94,
      this_month: 13,
      streak: 6,
      member_since: 'Jan 2024',
    }
    : role === 'teacher'
      ? {
        name: me.name,
        email: me.email,
        total_classes: 121,
        this_month: 17,
        streak: 8,
        member_since: 'Mar 2024',
      }
      : {
        name: me.name,
        email: me.email,
        total_classes: 37,
        this_month: 5,
        streak: 3,
        member_since: 'Aug 2025',
      }

  const attendance = [
    { date: datePlus(-1), class_name: 'Aerial Hoop Flow', checked_in: true },
    { date: datePlus(-4), class_name: 'Intro Pole', checked_in: true },
    { date: datePlus(-8), class_name: 'Strength & Flex', checked_in: role !== 'student' },
  ]

  return {
    classes,
    bookings,
    feedPosts: baseFeed,
    notifications,
    rosterByClassId,
    subscription,
    classPasses,
    compCredits,
    profile,
    attendance,
    calendarTokens: [],
  }
}

function getRoleState(role: DemoRole): DemoState {
  if (!stateByRole[role]) {
    stateByRole[role] = createInitialState(role)
  }
  return stateByRole[role] as DemoState
}

function splitPath(path: string) {
  const [pathname, queryString = ''] = path.split('?')
  return { pathname: pathname ?? '', query: new URLSearchParams(queryString) }
}

function getClass(state: DemoState, classId: string) {
  return state.classes.find((item) => item.id === classId) ?? null
}

function toScheduleItem(cls: DemoClass, state: DemoState, myUserId: string) {
  const isBooked = state.bookings.some((booking) =>
    booking.user_id === myUserId
    && booking.class_id === cls.id
    && booking.status === 'booked')

  return {
    id: cls.id,
    date: cls.date,
    start_time: cls.start_time,
    end_time: cls.end_time,
    status: cls.status,
    booking_count: cls.booking_count,
    max_capacity: cls.max_capacity,
    is_booked: isBooked,
    feed_enabled: cls.feed_enabled,
    studio_id: cls.studio_id,
    notes: cls.notes,
    template: cls.template,
    teacher: cls.teacher ? { id: cls.teacher.id, name: cls.teacher.name, avatar_url: cls.teacher.avatar_url } : null,
  }
}

function getMembershipRecord(role: DemoRole) {
  const identity = getDemoIdentity(role)
  return {
    id: `demo-membership-${role}`,
    studio_id: DEMO_STUDIO_ID,
    role: identity.roleLabel,
    status: 'active',
    plan_name: role === 'student' ? 'Unlimited Membership' : role === 'teacher' ? 'Staff Pass' : 'Owner Access',
    type: role === 'student' ? 'unlimited' : 'staff',
    classes_remaining: role === 'student' ? null : 10,
    expires_at: null,
    studio_name: DEMO_STUDIO.name,
    studio: {
      id: DEMO_STUDIO.id,
      name: DEMO_STUDIO.name,
      slug: DEMO_STUDIO.slug,
      discipline: DEMO_STUDIO.discipline,
    },
  }
}

function parseStudioPath(pathname: string, pattern: RegExp) {
  const match = pathname.match(pattern)
  if (!match) return null
  return match.slice(1)
}

function ensureStudioId(pathStudioId: string) {
  // In class detail screen the app currently passes classId as the studioId to feedApi.
  // Demo mode accepts both to keep UX smooth.
  if (pathStudioId === DEMO_STUDIO_ID) return true
  if (pathStudioId.startsWith('demo-class-')) return true
  return false
}

export function resetDemoState(role?: DemoRole) {
  if (role) {
    delete stateByRole[role]
    return
  }
  delete stateByRole.owner
  delete stateByRole.teacher
  delete stateByRole.student
}

export async function handleDemoApiRequest<T>(
  path: string,
  opts: RequestOpts,
  role: DemoRole,
): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase()
  const body = (opts.body ?? {}) as Record<string, unknown>
  const { pathname, query } = splitPath(path)
  const state = getRoleState(role)
  const me = getDemoIdentity(role)
  const isStaff = role === 'owner' || role === 'teacher'

  if (pathname === '/api/me/studios' && method === 'GET') {
    return clone([getMembershipRecord(role)]) as T
  }

  if (pathname === '/api/me/memberships' && method === 'GET') {
    return clone([getMembershipRecord(role)]) as T
  }

  if (pathname === '/api/my/bookings' && method === 'GET') {
    const studioFilter = query.get('studio_id')
    if (studioFilter && studioFilter !== DEMO_STUDIO_ID) return clone([]) as T

    const bookings = state.bookings
      .filter((booking) => booking.user_id === me.id && booking.status !== 'cancelled')
      .map((booking) => {
        const cls = getClass(state, booking.class_id)
        if (!cls) return null
        return {
          id: booking.id,
          status: booking.status,
          class_instance: {
            id: cls.id,
            date: cls.date,
            start_time: cls.start_time,
            end_time: cls.end_time,
            template: cls.template ? { name: cls.template.name } : null,
            teacher: cls.teacher ? { name: cls.teacher.name } : null,
          },
        }
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value))

    return clone(bookings) as T
  }

  if (pathname === '/api/my/profile' && method === 'GET') {
    return clone(state.profile) as T
  }

  if (pathname === '/api/my/attendance' && method === 'GET') {
    return clone(state.attendance) as T
  }

  if (pathname === '/api/my/comps' && method === 'GET') {
    return clone(state.compCredits) as T
  }

  if (pathname === '/api/my/calendar-token' && method === 'GET') {
    return clone({ tokens: state.calendarTokens }) as T
  }

  if (pathname === '/api/my/calendar-token' && method === 'POST') {
    const label = typeof body.label === 'string' && body.label.trim().length > 0
      ? body.label.trim()
      : 'My Classes'
    const tokenId = `demo-cal-${Date.now()}`
    const token = {
      id: tokenId,
      label,
      created_at: new Date().toISOString(),
      last_used_at: null,
    }
    state.calendarTokens.unshift(token)
    return {
      id: token.id,
      label: token.label,
      feedUrl: `https://api.studio.coop/api/calendar/demo/${token.id}.ics`,
      createdAt: token.created_at,
    } as T
  }

  const revokeCalendarMatch = pathname.match(/^\/api\/my\/calendar-token\/([^/]+)$/)
  if (revokeCalendarMatch && method === 'DELETE') {
    const tokenId = revokeCalendarMatch[1]
    state.calendarTokens = state.calendarTokens.filter((token) => token.id !== tokenId)
    return undefined as T
  }

  const scheduleMatch = parseStudioPath(pathname, /^\/api\/studios\/([^/]+)\/schedule$/)
  if (scheduleMatch && method === 'GET') {
    const [studioId] = scheduleMatch
    if (!studioId || !ensureStudioId(studioId)) return clone([]) as T

    const from = query.get('from')
    const to = query.get('to')
    const filtered = state.classes
      .filter((cls) => {
        if (from && cls.date < from) return false
        if (to && cls.date > to) return false
        return true
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .map((cls) => toScheduleItem(cls, state, me.id))

    return clone(filtered) as T
  }

  const classDetailMatch = parseStudioPath(pathname, /^\/api\/studios\/([^/]+)\/classes\/([^/]+)$/)
  if (classDetailMatch && method === 'GET') {
    const [studioId, classId] = classDetailMatch
    if (!studioId || !ensureStudioId(studioId)) throw new Error('Studio not found in demo')

    const cls = getClass(state, classId ?? '')
    if (!cls) throw new Error('Class not found in demo')

    const roster = state.rosterByClassId[cls.id] ?? []
    const bookingsFromRoster = roster
      .filter((entry) => entry.booking_id && entry.booking_status !== 'cancelled')
      .map((entry) => ({
        id: entry.booking_id as string,
        status: entry.booking_status ?? 'booked',
        user: { id: entry.user_id, name: entry.name, avatar_url: entry.avatar_url },
      }))

    for (const booking of state.bookings) {
      if (booking.class_id !== cls.id || booking.status === 'cancelled') continue
      if (bookingsFromRoster.some((entry) => entry.id === booking.id)) continue
      bookingsFromRoster.push({
        id: booking.id,
        status: booking.status,
        user: { id: me.id, name: me.name, avatar_url: null },
      })
    }

    return clone({
      ...toScheduleItem(cls, state, me.id),
      bookings: bookingsFromRoster,
      is_staff: isStaff,
      booking_count: cls.booking_count,
    }) as T
  }

  const bookMatch = parseStudioPath(pathname, /^\/api\/studios\/([^/]+)\/classes\/([^/]+)\/book$/)
  if (bookMatch && method === 'POST') {
    const [studioId, classId] = bookMatch
    if (!studioId || !ensureStudioId(studioId)) throw new Error('Studio not found in demo')
    const cls = getClass(state, classId ?? '')
    if (!cls) throw new Error('Class not found in demo')

    const isWaitlist = Boolean(body.waitlist)
    const existing = state.bookings.find((booking) => booking.class_id === cls.id && booking.user_id === me.id && booking.status !== 'cancelled')
    if (existing) {
      return clone({ booking_id: existing.id, status: existing.status }) as T
    }

    const status: DemoBookingRecord['status'] = isWaitlist || cls.booking_count >= cls.max_capacity ? 'waitlisted' : 'booked'
    const bookingId = `demo-booking-${Date.now()}`
    state.bookings.push({ id: bookingId, class_id: cls.id, user_id: me.id, status })
    if (status === 'booked') cls.booking_count += 1

    const roster = state.rosterByClassId[cls.id] ?? []
    state.rosterByClassId[cls.id] = roster
    if (!roster.find((entry) => entry.user_id === me.id)) {
      roster.push({
        user_id: me.id,
        name: me.name,
        avatar_url: null,
        booking_id: bookingId,
        booking_status: status,
        spot: String(roster.length + 1),
        checked_in: false,
        walk_in: false,
        notes: null,
      })
    }

    state.notifications.unshift({
      id: `demo-notif-${Date.now()}`,
      type: status === 'waitlisted' ? 'waitlist_promoted' : 'booking_confirmed',
      title: status === 'waitlisted' ? 'Waitlist updated' : 'Booking confirmed',
      body: `${status === 'waitlisted' ? 'You joined the waitlist for' : 'You are booked for'} ${cls.template?.name ?? 'class'}.`,
      sent_at: new Date().toISOString(),
      read_at: null,
    })

    return clone({ booking_id: bookingId, status }) as T
  }

  const cancelBookingMatch = pathname.match(/^\/api\/bookings\/([^/]+)$/)
  if (cancelBookingMatch && method === 'DELETE') {
    const bookingId = cancelBookingMatch[1]
    const booking = state.bookings.find((entry) => entry.id === bookingId)
    if (booking && booking.status !== 'cancelled') {
      booking.status = 'cancelled'
      const cls = getClass(state, booking.class_id)
      if (cls && cls.booking_count > 0) cls.booking_count -= 1
      const roster = state.rosterByClassId[booking.class_id]
      if (roster) {
        for (const entry of roster) {
          if (entry.booking_id === bookingId) {
            entry.booking_status = 'cancelled'
          }
        }
      }
    }
    return undefined as T
  }

  const feedMatch = parseStudioPath(pathname, /^\/api\/studios\/([^/]+)\/feed$/)
  if (feedMatch && method === 'GET') {
    const [studioId] = feedMatch
    if (!studioId || !ensureStudioId(studioId)) return clone([]) as T
    return clone(state.feedPosts.sort((a, b) => b.created_at.localeCompare(a.created_at))) as T
  }

  if (feedMatch && method === 'POST') {
    const [studioId] = feedMatch
    if (!studioId || !ensureStudioId(studioId)) throw new Error('Studio not found in demo')

    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const mediaUrls = Array.isArray(body.media_urls)
      ? body.media_urls.filter((url): url is string => typeof url === 'string' && url.length > 0).slice(0, 4)
      : []
    const postType: DemoFeedPost['post_type'] = mediaUrls.length > 0 ? 'photo' : 'text'
    const post = {
      id: `demo-feed-${Date.now()}`,
      content: content.length > 0 ? content : null,
      post_type: postType,
      media_urls: mediaUrls,
      created_at: new Date().toISOString(),
      user: { id: me.id, name: me.name, avatar_url: null },
      class_name: null,
      reactions: [
        { emoji: '❤️', count: 0, reacted: false },
        { emoji: '🔥', count: 0, reacted: false },
        { emoji: '👏', count: 0, reacted: false },
      ],
    } satisfies DemoFeedPost
    state.feedPosts.unshift(post)
    return clone(post) as T
  }

  const reactMatch = pathname.match(/^\/api\/feed\/([^/]+)\/react$/)
  if (reactMatch && method === 'POST') {
    const postId = reactMatch[1]
    const emoji = typeof body.emoji === 'string' ? body.emoji : ''
    const post = state.feedPosts.find((entry) => entry.id === postId)
    if (!post || !emoji) return undefined as T

    let reaction = post.reactions.find((entry) => entry.emoji === emoji)
    if (!reaction) {
      reaction = { emoji, count: 0, reacted: false }
      post.reactions.push(reaction)
    }
    if (reaction.reacted) {
      reaction.reacted = false
      reaction.count = Math.max(0, reaction.count - 1)
    } else {
      reaction.reacted = true
      reaction.count += 1
    }
    return clone({ ok: true }) as T
  }

  const deleteFeedMatch = pathname.match(/^\/api\/feed\/([^/]+)$/)
  if (deleteFeedMatch && method === 'DELETE') {
    const postId = deleteFeedMatch[1]
    state.feedPosts = state.feedPosts.filter((entry) => entry.id !== postId)
    return undefined as T
  }

  const rosterMatch = pathname.match(/^\/api\/classes\/([^/]+)\/roster$/)
  if (rosterMatch && method === 'GET') {
    const classId = rosterMatch[1]
    const cls = getClass(state, classId ?? '')
    if (!cls) throw new Error('Class not found in demo')
    const roster = state.rosterByClassId[classId ?? ''] ?? []
    return clone({
      class_instance: {
        id: cls.id,
        date: cls.date,
        start_time: cls.start_time,
        status: cls.status,
        max_capacity: cls.max_capacity,
        studio_id: cls.studio_id,
        template: cls.template ? { name: cls.template.name } : null,
        teacher: cls.teacher ? { name: cls.teacher.name } : null,
      },
      roster,
      is_staff: isStaff,
    }) as T
  }

  const checkinMatch = pathname.match(/^\/api\/classes\/([^/]+)\/checkin$/)
  if (checkinMatch && method === 'POST') {
    if (!isStaff) throw new Error('Staff access required in demo')
    const classId = checkinMatch[1]
    const roster = state.rosterByClassId[classId ?? ''] ?? []
    state.rosterByClassId[classId ?? ''] = roster

    if (Array.isArray(body.attendees)) {
      const attendees = body.attendees as Array<{ userId?: string; checkedIn?: boolean }>
      for (const attendee of attendees) {
        if (!attendee.userId) continue
        const entry = roster.find((item) => item.user_id === attendee.userId)
        if (entry) entry.checked_in = Boolean(attendee.checkedIn)
      }
    } else if (typeof body.user_id === 'string') {
      const entry = roster.find((item) => item.user_id === body.user_id)
      if (entry) entry.checked_in = true
    }

    const cls = getClass(state, classId ?? '')
    if (cls && cls.status === 'scheduled') cls.status = 'in_progress'
    return clone({ ok: true }) as T
  }

  const walkinMatch = pathname.match(/^\/api\/classes\/([^/]+)\/walkin$/)
  if (walkinMatch && method === 'POST') {
    if (!isStaff) throw new Error('Staff access required in demo')
    const classId = walkinMatch[1]
    const roster = state.rosterByClassId[classId ?? ''] ?? []
    state.rosterByClassId[classId ?? ''] = roster
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const displayName = email.split('@')[0]?.replace(/[^a-z0-9]+/gi, ' ').trim() || 'Walk-in'
    const walkin = {
      user_id: `demo-walkin-${Date.now()}`,
      name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      avatar_url: null,
      booking_id: null,
      booking_status: null,
      spot: String(roster.length + 1),
      checked_in: true,
      walk_in: true,
      notes: null,
    } satisfies DemoRosterEntry
    roster.push(walkin)
    const cls = getClass(state, classId ?? '')
    if (cls) cls.booking_count += 1
    return clone({ ok: true }) as T
  }

  const completeClassMatch = pathname.match(/^\/api\/classes\/([^/]+)\/complete$/)
  if (completeClassMatch && method === 'POST') {
    if (!isStaff) throw new Error('Staff access required in demo')
    const classId = completeClassMatch[1]
    const cls = getClass(state, classId ?? '')
    if (cls) cls.status = 'completed'
    return clone({ ok: true }) as T
  }

  if (pathname === '/api/my/notifications' && method === 'GET') {
    return clone(state.notifications.sort((a, b) => b.sent_at.localeCompare(a.sent_at))) as T
  }

  if (pathname === '/api/my/notifications/count' && method === 'GET') {
    const count = state.notifications.filter((entry) => entry.read_at === null).length
    return clone({ count }) as T
  }

  const markReadMatch = pathname.match(/^\/api\/my\/notifications\/([^/]+)\/read$/)
  if (markReadMatch && method === 'POST') {
    const id = markReadMatch[1]
    const entry = state.notifications.find((item) => item.id === id)
    if (entry && !entry.read_at) entry.read_at = new Date().toISOString()
    return clone({ ok: true }) as T
  }

  if (pathname === '/api/my/notifications/read-all' && method === 'POST') {
    const now = new Date().toISOString()
    for (const notification of state.notifications) {
      if (!notification.read_at) notification.read_at = now
    }
    return clone({ ok: true }) as T
  }

  if (pathname === '/api/my/push-token' && (method === 'POST' || method === 'DELETE')) {
    return clone({ ok: true }) as T
  }

  if (pathname === '/api/my/notification-preferences' && method === 'GET') {
    return clone({
      class_reminder_24h: true,
      booking_confirmed: true,
      waitlist_promoted: true,
      class_cancelled: true,
    }) as T
  }

  if (pathname === '/api/my/notification-preferences' && method === 'PUT') {
    return clone({ ok: true }) as T
  }

  const plansMatch = pathname.match(/^\/api\/studios\/([^/]+)\/plans$/)
  if (plansMatch && method === 'GET') {
    const studioId = plansMatch[1]
    if (!studioId || !ensureStudioId(studioId)) throw new Error('Studio not found in demo')
    return clone({ plans: DEMO_PLANS }) as T
  }

  const subscribeMatch = pathname.match(/^\/api\/studios\/([^/]+)\/plans\/([^/]+)\/subscribe$/)
  if (subscribeMatch && method === 'POST') {
    return clone({
      checkoutUrl: 'https://studio.coop/demo-checkout?provider=stripe&status=success',
    }) as T
  }

  const purchaseMatch = pathname.match(/^\/api\/studios\/([^/]+)\/plans\/([^/]+)\/purchase$/)
  if (purchaseMatch && method === 'POST') {
    return clone({
      clientSecret: 'demo_client_secret_class_pack',
    }) as T
  }

  const dropInMatch = pathname.match(/^\/api\/studios\/([^/]+)\/classes\/([^/]+)\/drop-in$/)
  if (dropInMatch && method === 'POST') {
    return clone({
      clientSecret: 'demo_client_secret_drop_in',
      amount: 2500,
      currency: 'nzd',
    }) as T
  }

  const mySubMatch = pathname.match(/^\/api\/studios\/([^/]+)\/my-subscription$/)
  if (mySubMatch && method === 'GET') {
    return clone({
      subscription: state.subscription,
      classPasses: state.classPasses,
    }) as T
  }

  const cancelSubMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)\/cancel$/)
  if (cancelSubMatch && method === 'POST') {
    if (state.subscription && state.subscription.id === cancelSubMatch[1]) {
      state.subscription.cancel_at_period_end = true
    }
    return clone({ ok: true }) as T
  }

  const pauseSubMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)\/pause$/)
  if (pauseSubMatch && method === 'POST') {
    if (state.subscription && state.subscription.id === pauseSubMatch[1]) {
      state.subscription.status = 'paused'
    }
    return clone({ ok: true }) as T
  }

  const resumeSubMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)\/resume$/)
  if (resumeSubMatch && method === 'POST') {
    if (state.subscription && state.subscription.id === resumeSubMatch[1]) {
      state.subscription.status = 'active'
    }
    return clone({ ok: true }) as T
  }

  if (pathname === '/api/discover/filters' && method === 'GET') {
    return clone({
      cities: ['Wellington'],
      disciplines: ['aerial', 'pole', 'dance'],
      locations: [
        { country_code: 'NZ', regions: ['Wellington'], cities: ['Wellington'] },
      ],
    }) as T
  }

  if (pathname === '/api/discover/studios' && method === 'GET') {
    const q = query.get('q')?.toLowerCase().trim() ?? ''
    const discipline = query.get('discipline')?.toLowerCase().trim() ?? ''
    const city = query.get('city')?.toLowerCase().trim() ?? ''
    const country = query.get('country')?.toUpperCase().trim() ?? ''
    const region = query.get('region')?.toLowerCase().trim() ?? ''

    const matchesSearch = q.length === 0
      || DEMO_STUDIO.name.toLowerCase().includes(q)
      || DEMO_STUDIO.discipline.toLowerCase().includes(q)
      || DEMO_STUDIO.slug.toLowerCase().includes(q)

    const matchesDiscipline = discipline.length === 0 || DEMO_STUDIO.discipline.toLowerCase() === discipline
    const matchesCity = city.length === 0 || (DEMO_STUDIO.city ?? '').toLowerCase() === city
    const matchesCountry = country.length === 0 || (DEMO_STUDIO.country_code ?? '') === country
    const matchesRegion = region.length === 0 || (DEMO_STUDIO.region ?? '').toLowerCase() === region

    const studios = (matchesSearch && matchesDiscipline && matchesCity && matchesCountry && matchesRegion)
      ? [
        {
          id: DEMO_STUDIO.id,
          name: DEMO_STUDIO.name,
          slug: DEMO_STUDIO.slug,
          discipline: DEMO_STUDIO.discipline,
          description: DEMO_STUDIO.description,
          logo_url: DEMO_STUDIO.logo_url,
          city: DEMO_STUDIO.city,
          country_code: DEMO_STUDIO.country_code,
          region: DEMO_STUDIO.region,
          distance_km: query.get('lat') && query.get('lng') ? 2.1 : null,
          member_count: 84,
          upcoming_class_count: state.classes.filter((cls) => cls.status === 'scheduled').length,
        },
      ]
      : []

    return clone({
      studios,
      total: studios.length,
      page: 1,
      limit: Number(query.get('limit') ?? 30),
    }) as T
  }

  const discoverStudioMatch = pathname.match(/^\/api\/discover\/studios\/([^/]+)$/)
  if (discoverStudioMatch && method === 'GET') {
    const idOrSlug = discoverStudioMatch[1]
    if (idOrSlug !== DEMO_STUDIO.id && idOrSlug !== DEMO_STUDIO.slug) {
      throw new Error('Studio not found in demo')
    }

    const classes = state.classes
      .filter((cls) => cls.status === 'scheduled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .map((cls) => ({
        id: cls.id,
        date: cls.date,
        start_time: cls.start_time,
        end_time: cls.end_time,
        max_capacity: cls.max_capacity,
        booked_count: cls.booking_count,
        teacher: cls.teacher ? { name: cls.teacher.name } : null,
        template: cls.template ? { name: cls.template.name, description: cls.template.description } : null,
      }))

    const payload = {
      ...DEMO_STUDIO,
      studio: clone(DEMO_STUDIO),
      classes,
      plans: clone(DEMO_PLANS.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        type: plan.type,
        price_cents: plan.price_cents,
        currency: plan.currency,
        interval: plan.interval,
        class_limit: plan.class_limit,
        validity_days: plan.validity_days,
      }))),
      member_count: 84,
    }
    return clone(payload) as T
  }

  throw new Error(`Demo API does not handle: ${method} ${pathname}`)
}
