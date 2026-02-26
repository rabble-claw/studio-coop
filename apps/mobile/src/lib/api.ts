import AsyncStorage from '@react-native-async-storage/async-storage'

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
  instances: (studioId: string, params?: string) => api.get(`/studios/${studioId}/instances${params ? `?${params}` : ''}`),
  instanceDetail: (studioId: string, instanceId: string) => api.get(`/studios/${studioId}/instances/${instanceId}`),
}

// Bookings
export const bookingApi = {
  book: (studioId: string, instanceId: string) => api.post(`/studios/${studioId}/instances/${instanceId}/book`),
  cancel: (studioId: string, instanceId: string) => api.post(`/studios/${studioId}/instances/${instanceId}/cancel-booking`),
  joinWaitlist: (studioId: string, instanceId: string) => api.post(`/studios/${studioId}/instances/${instanceId}/waitlist`),
  myBookings: (studioId: string) => api.get(`/studios/${studioId}/me/bookings`),
}

// Check-in
export const checkinApi = {
  getAttendees: (studioId: string, instanceId: string) => api.get(`/studios/${studioId}/instances/${instanceId}/attendees`),
  checkin: (studioId: string, instanceId: string, userId: string) => api.post(`/studios/${studioId}/instances/${instanceId}/checkin`, { user_id: userId }),
  batchCheckin: (studioId: string, instanceId: string, userIds: string[]) => api.post(`/studios/${studioId}/instances/${instanceId}/checkin/batch`, { user_ids: userIds }),
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

// Notifications
export const notificationApi = {
  list: () => api.get('/me/notifications'),
  markRead: (id: string) => api.put(`/me/notifications/${id}/read`),
  registerPush: (token: string) => api.post('/me/push-token', { token }),
  preferences: () => api.get('/me/notification-preferences'),
  updatePreferences: (data: unknown) => api.put('/me/notification-preferences', data),
}

export { ApiError }
