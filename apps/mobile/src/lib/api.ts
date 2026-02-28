import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('auth_token')
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem('auth_token', token)
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem('auth_token')
}

async function request<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message || res.statusText)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post<{ token: string; user: unknown }>('/auth/login', { email, password }),
  signup: (data: { email: string; password: string; name: string }) => api.post<{ token: string; user: unknown }>('/auth/signup', data),
  me: () => api.get<{ user: unknown }>('/auth/me'),
}

// Studios
export const studioApi = {
  myStudios: () => api.get<unknown[]>('/me/studios'),
  get: (id: string) => api.get(`/studios/${id}`),
}

// Schedule
export const scheduleApi = {
  list: (studioId: string, params?: string) => api.get(`/studios/${studioId}/schedule${params ? `?${params}` : ''}`),
  instanceDetail: (studioId: string, instanceId: string) => api.get(`/studios/${studioId}/classes/${instanceId}`),
}

// Bookings
export const bookingApi = {
  book: (studioId: string, classId: string) => api.post(`/studios/${studioId}/classes/${classId}/book`),
  cancel: (bookingId: string) => api.delete(`/bookings/${bookingId}`),
  joinWaitlist: (studioId: string, classId: string) => api.post(`/studios/${studioId}/classes/${classId}/book`, { waitlist: true }),
  myBookings: () => api.get('/my/bookings'),
  listMy: (studioId: string) => api.get(`/my/bookings?studio_id=${studioId}`),
}

// Check-in
export const checkinApi = {
  getRoster: (classId: string) => api.get(`/classes/${classId}/roster`),
  checkin: (classId: string, userId: string) => api.post(`/classes/${classId}/checkin`, { user_id: userId }),
  batchCheckin: (classId: string, userIds: string[]) => api.post(`/classes/${classId}/checkin/batch`, { user_ids: userIds }),
  addWalkin: (classId: string, email: string) => api.post(`/classes/${classId}/walkin`, { email }),
  completeClass: (classId: string) => api.post(`/classes/${classId}/complete`),
}

// Feed
export const feedApi = {
  getFeed: (studioId: string, instanceId?: string) => api.get(`/studios/${studioId}/feed${instanceId ? `?instance_id=${instanceId}` : ''}`),
  createPost: (studioId: string, data: { content: string; class_instance_id?: string; media_urls?: string[] }) => api.post(`/studios/${studioId}/feed`, data),
  react: (studioId: string, postId: string, emoji: string) => api.post(`/studios/${studioId}/feed/${postId}/react`, { emoji }),
}

// Profile
export const profileApi = {
  get: () => api.get('/me/profile'),
  update: (data: unknown) => api.put('/me/profile', data),
  memberships: () => api.get('/me/memberships'),
  attendance: (studioId: string) => api.get(`/studios/${studioId}/me/attendance`),
  classPasses: (studioId: string) => api.get(`/studios/${studioId}/me/passes`),
  comps: (studioId: string) => api.get(`/studios/${studioId}/me/comps`),
}

// Subscriptions
export const subscriptionApi = {
  mine: (studioId: string) => api.get(`/studios/${studioId}/me/subscription`),
  cancel: (subscriptionId: string) => api.post(`/subscriptions/${subscriptionId}/cancel`),
  pause: (subscriptionId: string, resumeDate?: string) => api.post(`/subscriptions/${subscriptionId}/pause`, resumeDate ? { resume_date: resumeDate } : undefined),
  resume: (subscriptionId: string) => api.post(`/subscriptions/${subscriptionId}/resume`),
}

// Notifications
export const notificationApi = {
  list: () => api.get('/me/notifications'),
  markRead: (id: string) => api.post(`/me/notifications/${id}/read`),
  markAllRead: () => api.post('/me/notifications/read-all'),
  unreadCount: () => api.get<{ count: number }>('/me/notifications/count'),
  registerPush: (token: string) => api.post('/me/push-token', { token, platform: Platform.OS }),
  preferences: () => api.get('/me/notification-preferences'),
  updatePreferences: (data: unknown) => api.put('/me/notification-preferences', data),
}

// Studios
export const studioListApi = {
  myStudios: () => api.get<Array<{ id: string; studio_id: string; role: string; studio: { id: string; name: string; slug: string; discipline: string } }>>('/me/memberships'),
}

export { ApiError }
