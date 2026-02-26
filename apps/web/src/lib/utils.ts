import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

export function formatDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function getDayName(dayOfWeek: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]
}

export function getRoleBadgeColor(role: string) {
  switch (role) {
    case 'owner': return 'bg-amber-100 text-amber-800'
    case 'admin': return 'bg-purple-100 text-purple-800'
    case 'teacher': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-700'
  }
}
