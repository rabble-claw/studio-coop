// Demo data for Empire Aerial Arts — used when NEXT_PUBLIC_SUPABASE_URL is not configured

const STUDIO_ID = 'demo-empire-001'
const TEACHER_EMMA_ID = 'demo-teacher-emma'
const TEACHER_JADE_ID = 'demo-teacher-jade'
const TEACHER_SAM_ID = 'demo-teacher-sam'
const TEACHER_ARIA_ID = 'demo-teacher-aria'

export const isDemoMode = () =>
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

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

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today)
    date.setDate(today.getDate() + dayOffset)
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]

    const slots = dayOfWeek === 0 || dayOfWeek === 6 ? weekendSlots : weekdaySlots
    if (dayOfWeek === 0 && dayOffset > 7) continue // skip second Sunday

    for (const slot of slots) {
      const tplId = slot.templates[dayOffset % slot.templates.length]
      const tpl = demoTemplates.find((t) => t.id === tplId)!
      const teacherId = teachers[(dayOffset + slots.indexOf(slot)) % teachers.length]
      const booked = Math.floor(Math.random() * (tpl.default_capacity - 2)) + 1

      classes.push({
        id: `cls-${dateStr}-${slot.time.replace(':', '')}`,
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
        teacher: { name: teacherMap[teacherId] },
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
  teacher: { name: string }
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

export const demoFeedPosts = [
  {
    id: 'post-1',
    author: 'Alex',
    content: 'Amazing progress in Level 2 tonight! 🤩 Everyone nailed their first shoulder mount. So proud of this crew.',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    class_name: 'Pole Technique Level 2',
    likes: 8,
  },
  {
    id: 'post-2',
    author: 'Jade',
    content: 'Reminder: Open Practice this Saturday has extra silks rigged! Come play 🎪',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    class_name: null,
    likes: 12,
  },
  {
    id: 'post-3',
    author: 'Kai',
    content: 'Just booked my first aerial hoop class. Terrified and excited in equal measure 😅',
    created_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    class_name: null,
    likes: 15,
  },
  {
    id: 'post-4',
    author: 'Sam',
    content: 'Flexibility class tomorrow — we\'re working on middle splits. Bring your patience and a foam roller! 🧘',
    created_at: new Date(Date.now() - 42 * 60 * 60 * 1000).toISOString(),
    class_name: 'Flexibility & Conditioning',
    likes: 6,
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
