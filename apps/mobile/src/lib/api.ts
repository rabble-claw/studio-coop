import { Platform } from 'react-native'
import { supabase } from './supabase'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
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

// Studios
export const studioApi = {
  myStudios: () => api.get<unknown[]>('/api/me/studios'),
  get: (id: string) => api.get(`/api/studios/${id}`),
}

// Schedule
export const scheduleApi = {
  list: (studioId: string, params?: string) => api.get(`/api/studios/${studioId}/schedule${params ? `?${params}` : ''}`),
  instanceDetail: (studioId: string, instanceId: string) => api.get(`/api/studios/${studioId}/classes/${instanceId}`),
}

// Bookings
export const bookingApi = {
  book: (studioId: string, classId: string) => api.post(`/api/studios/${studioId}/classes/${classId}/book`),
  cancel: (bookingId: string) => api.delete(`/api/bookings/${bookingId}`),
  joinWaitlist: (studioId: string, classId: string) => api.post(`/api/studios/${studioId}/classes/${classId}/book`, { waitlist: true }),
  myBookings: () => api.get('/api/my/bookings'),
  listMy: (studioId: string) => api.get(`/api/my/bookings?studio_id=${studioId}`),
}

// Check-in
export const checkinApi = {
  getRoster: (classId: string) => api.get(`/api/classes/${classId}/roster`),
  checkin: (classId: string, userId: string) => api.post(`/api/classes/${classId}/checkin`, { user_id: userId }),
  batchCheckin: (classId: string, userIds: string[]) => api.post(`/api/classes/${classId}/checkin/batch`, { user_ids: userIds }),
  addWalkin: (classId: string, email: string) => api.post(`/api/classes/${classId}/walkin`, { email }),
  completeClass: (classId: string) => api.post(`/api/classes/${classId}/complete`),
}

// Feed
export const feedApi = {
  getFeed: (studioId: string, instanceId?: string) => api.get(`/api/studios/${studioId}/feed${instanceId ? `?instance_id=${instanceId}` : ''}`),
  createPost: (studioId: string, data: { content: string; class_instance_id?: string; media_urls?: string[] }) => api.post(`/api/studios/${studioId}/feed`, data),
  react: (studioId: string, postId: string, emoji: string) => api.post(`/api/studios/${studioId}/feed/${postId}/react`, { emoji }),
}

// Upload
export const uploadApi = {
  uploadImage: async (studioId: string, classId: string, uri: string, mimeType: string): Promise<{ url: string }> => {
    const token = await getToken()
    const formData = new FormData()
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
    formData.append('file', {
      uri,
      name: `photo.${ext}`,
      type: mimeType,
    } as unknown as Blob)
    formData.append('studioId', studioId)
    formData.append('classId', classId)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }))
      throw new ApiError(res.status, error.message || res.statusText)
    }

    return res.json()
  },
}

// Profile
export const profileApi = {
  get: () => api.get('/api/me/profile'),
  update: (data: unknown) => api.put('/api/me/profile', data),
  memberships: () => api.get('/api/me/memberships'),
  attendance: (studioId: string) => api.get(`/api/studios/${studioId}/me/attendance`),
  classPasses: (studioId: string) => api.get(`/api/studios/${studioId}/me/passes`),
  comps: (studioId: string) => api.get(`/api/studios/${studioId}/me/comps`),
}

// Subscriptions
export const subscriptionApi = {
  mine: (studioId: string) => api.get(`/api/studios/${studioId}/me/subscription`),
  cancel: (subscriptionId: string) => api.post(`/api/subscriptions/${subscriptionId}/cancel`),
  pause: (subscriptionId: string, resumeDate?: string) => api.post(`/api/subscriptions/${subscriptionId}/pause`, resumeDate ? { resume_date: resumeDate } : undefined),
  resume: (subscriptionId: string) => api.post(`/api/subscriptions/${subscriptionId}/resume`),
}

// Notifications
export const notificationApi = {
  list: () => api.get('/api/my/notifications'),
  markRead: (id: string) => api.post(`/api/my/notifications/${id}/read`),
  markAllRead: () => api.post('/api/my/notifications/read-all'),
  unreadCount: () => api.get<{ count: number }>('/api/my/notifications/count'),
  registerPush: (token: string) => api.post('/api/me/push-token', { token, platform: Platform.OS }),
  preferences: () => api.get('/api/me/notification-preferences'),
  updatePreferences: (data: unknown) => api.put('/api/me/notification-preferences', data),
}

// Payments / Stripe
export const paymentApi = {
  /** List available plans for a studio (public) */
  listPlans: (studioId: string) =>
    api.get<{ plans: Array<{ id: string; name: string; description: string | null; type: string; price_cents: number; currency: string; interval: string; class_limit: number | null; validity_days: number | null; stripe_price_id: string | null; active: boolean; sort_order: number }> }>(`/api/studios/${studioId}/plans`),

  /** Purchase a class pack — returns clientSecret for PaymentSheet */
  purchaseClassPack: (studioId: string, planId: string) =>
    api.post<{ clientSecret: string }>(`/api/studios/${studioId}/plans/${planId}/purchase`),

  /** Subscribe to a plan — returns checkoutUrl for web redirect */
  subscribe: (studioId: string, planId: string, body?: { couponCode?: string; successUrl?: string; cancelUrl?: string }) =>
    api.post<{ checkoutUrl: string }>(`/api/studios/${studioId}/plans/${planId}/subscribe`, body),

  /** Drop-in payment for a specific class */
  dropIn: (studioId: string, classId: string) =>
    api.post<{ clientSecret: string; amount: number; currency: string }>(`/api/studios/${studioId}/classes/${classId}/drop-in`),

  /** Get current subscription + class passes for a studio */
  mySubscription: (studioId: string) =>
    api.get<{ subscription: unknown | null; classPasses: unknown[] }>(`/api/studios/${studioId}/my-subscription`),
}

// Studios
export const studioListApi = {
  myStudios: () => api.get<Array<{ id: string; studio_id: string; role: string; studio: { id: string; name: string; slug: string; discipline: string } }>>('/api/me/memberships'),
}

// Discover (public, no auth required)
export const discoverApi = {
  filters: () => api.get<{ cities: string[]; disciplines: string[]; locations: Array<{ country_code: string; regions: string[]; cities: string[] }> }>('/api/discover/filters'),
  studios: (queryString?: string) => api.get<{ studios: Array<{ id: string; name: string; slug: string; discipline: string; description: string | null; logo_url: string | null; city: string | null; country_code: string | null; region: string | null; distance_km: number | null; member_count: number; upcoming_class_count: number }>; total: number; page: number; limit: number }>(`/api/discover/studios${queryString ?? ''}`),
  studioBySlug: (slug: string) => api.get<{ studio: { id: string; name: string; slug: string; discipline: string; description: string | null; logo_url: string | null; address: string | null; phone: string | null; website: string | null; email: string | null; instagram: string | null; facebook: string | null; city: string | null; country_code: string | null; region: string | null; latitude: number | null; longitude: number | null }; classes: Array<{ id: string; date: string; start_time: string; end_time: string; max_capacity: number; booked_count: number | null; teacher: { name: string } | null; template: { name: string; description: string | null } | null }>; plans: Array<{ id: string; name: string; description: string | null; type: string; price_cents: number; currency: string; interval: string; class_limit: number | null; validity_days: number | null }>; member_count: number }>(`/api/discover/studios/${slug}`),
}

export { ApiError }
