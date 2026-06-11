export type DemoRole = 'owner' | 'teacher' | 'student'

export const DEMO_MODE_STORAGE_KEY = 'demo_mode_role'
export const DEMO_STUDIO_ID = 'demo-studio-empire'
export const DEMO_STUDIO_SLUG = 'empire-aerial-arts'

type DemoIdentity = {
  id: string
  name: string
  email: string
  roleLabel: string
}

const DEMO_IDENTITIES: Record<DemoRole, DemoIdentity> = {
  owner: {
    id: 'demo-owner-001',
    name: 'Emma Owner',
    email: 'emma@demo.studio',
    roleLabel: 'owner',
  },
  teacher: {
    id: 'demo-teacher-001',
    name: 'Jade Teacher',
    email: 'jade@demo.studio',
    roleLabel: 'teacher',
  },
  student: {
    id: 'demo-student-001',
    name: 'Sam Student',
    email: 'sam@demo.studio',
    roleLabel: 'student',
  },
}

let activeDemoRole: DemoRole | null = null

export function isDemoRole(value: unknown): value is DemoRole {
  return value === 'owner' || value === 'teacher' || value === 'student'
}

export function getDemoModeRole(): DemoRole | null {
  return activeDemoRole
}

export function setDemoModeRole(role: DemoRole | null) {
  activeDemoRole = role
}

export function getDemoIdentity(role: DemoRole): DemoIdentity {
  return DEMO_IDENTITIES[role]
}

export function getDemoStudios(role: DemoRole) {
  return [
    {
      id: DEMO_STUDIO_ID,
      name: 'Empire Aerial Arts',
      discipline: 'aerial',
      role: DEMO_IDENTITIES[role].roleLabel,
    },
  ]
}
