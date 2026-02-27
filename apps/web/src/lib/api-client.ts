import { createClient } from './supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ApiOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

async function request<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const token = await getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  }
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
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}

// Typed API endpoints
export const studioApi = {
  get: (studioId: string) => api.get(`/studios/${studioId}`),
  update: (studioId: string, data: unknown) => api.put(`/studios/${studioId}`, data),
  getSettings: (studioId: string) => api.get(`/studios/${studioId}/settings`),
  updateSettings: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings`, data),
}

export const scheduleApi = {
  getTemplates: (studioId: string) => api.get(`/studios/${studioId}/templates`),
  createTemplate: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/templates`, data),
  updateTemplate: (studioId: string, templateId: string, data: unknown) => api.put(`/studios/${studioId}/templates/${templateId}`, data),
  deleteTemplate: (studioId: string, templateId: string) => api.delete(`/studios/${studioId}/templates/${templateId}`),
  getInstances: (studioId: string, params?: string) => api.get(`/studios/${studioId}/schedule${params ? `?${params}` : ''}`),
  cancelInstance: (studioId: string, instanceId: string, reason?: string) => api.post(`/studios/${studioId}/instances/${instanceId}/cancel`, { reason }),
}

export const memberApi = {
  list: (studioId: string, params?: string) => api.get(`/studios/${studioId}/members${params ? `?${params}` : ''}`),
  get: (studioId: string, memberId: string) => api.get(`/studios/${studioId}/members/${memberId}`),
  addNote: (studioId: string, memberId: string, note: string) => api.post(`/studios/${studioId}/members/${memberId}/notes`, { note }),
  grantComp: (studioId: string, memberId: string, data: unknown) => api.post(`/studios/${studioId}/members/${memberId}/comps`, data),
}

export const planApi = {
  list: (studioId: string) => api.get(`/studios/${studioId}/plans`),
  create: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/plans`, data),
  update: (studioId: string, planId: string, data: unknown) => api.put(`/studios/${studioId}/plans/${planId}`, data),
  delete: (studioId: string, planId: string) => api.delete(`/studios/${studioId}/plans/${planId}`),
  getSubscribers: (studioId: string, planId: string) => api.get(`/studios/${studioId}/plans/${planId}/subscribers`),
}

export const couponApi = {
  list: (studioId: string) => api.get(`/studios/${studioId}/coupons`),
  create: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/coupons`, data),
  update: (studioId: string, couponId: string, data: unknown) => api.put(`/studios/${studioId}/coupons/${couponId}`, data),
  delete: (studioId: string, couponId: string) => api.delete(`/studios/${studioId}/coupons/${couponId}`),
}

export const bookingApi = {
  list: (studioId: string, params?: string) => api.get(`/studios/${studioId}/bookings${params ? `?${params}` : ''}`),
  privateList: (studioId: string) => api.get(`/studios/${studioId}/private-bookings`),
  privateCreate: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/private-bookings`, data),
  privateUpdate: (studioId: string, bookingId: string, data: unknown) => api.put(`/studios/${studioId}/private-bookings/${bookingId}`, data),
}

export const reportApi = {
  attendance: (studioId: string, params?: string) => api.get(`/studios/${studioId}/reports/attendance${params ? `?${params}` : ''}`),
  revenue: (studioId: string, params?: string) => api.get(`/studios/${studioId}/reports/revenue${params ? `?${params}` : ''}`),
  retention: (studioId: string, params?: string) => api.get(`/studios/${studioId}/reports/retention${params ? `?${params}` : ''}`),
  popular: (studioId: string) => api.get(`/studios/${studioId}/reports/popular-classes`),
}

export interface FeedPost {
  id: string
  content: string | null
  media_urls: string[] | null
  post_type: string
  created_at: string
  class_instance_id: string
  class_instance: { id: string; date: string; template: { name: string } | null } | null
  author: { id: string; name: string; avatar_url: string | null }
  reactions: Array<{ emoji: string; count: number; reacted: boolean }>
}

export const feedApi = {
  getStudioFeed: (studioId: string) =>
    api.get<FeedPost[]>(`/studios/${studioId}/feed`),
  createPost: (classId: string, data: { content?: string; media_urls?: string[] }) =>
    api.post<FeedPost>(`/classes/${classId}/feed`, data),
  addReaction: (postId: string, emoji: string) =>
    api.post<{ ok: boolean }>(`/feed/${postId}/react`, { emoji }),
  removeReaction: (postId: string, emoji: string) =>
    api.delete<{ ok: boolean }>(`/feed/${postId}/react`, { emoji }),
}

export { ApiError }
