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
  const { createClient } = await import('@/lib/supabase/client')
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
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// Typed API endpoints
export const studioApi = {
  get: (studioId: string) => api.get(`/studios/${studioId}`),
  update: (studioId: string, data: unknown) => api.put(`/studios/${studioId}`, data),
  getSettings: (studioId: string) => api.get<{ studioId: string; general: Record<string, unknown>; notifications: Record<string, unknown>; cancellation: Record<string, unknown> }>(`/studios/${studioId}/settings`),
  updateGeneral: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/general`, data),
  updateNotifications: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/notifications`, data),
  updateCancellation: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/cancellation`, data),
}

export const scheduleApi = {
  getTemplates: (studioId: string) => api.get(`/studios/${studioId}/templates`),
  createTemplate: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/templates`, data),
  updateTemplate: (studioId: string, templateId: string, data: unknown) => api.put(`/studios/${studioId}/templates/${templateId}`, data),
  deleteTemplate: (studioId: string, templateId: string) => api.delete(`/studios/${studioId}/templates/${templateId}`),
  getInstances: (studioId: string, params?: string) => api.get(`/studios/${studioId}/instances${params ? `?${params}` : ''}`),
  cancelInstance: (studioId: string, instanceId: string, reason?: string) => api.post(`/studios/${studioId}/instances/${instanceId}/cancel`, { reason }),
  restoreClass: (studioId: string, classId: string) => api.post(`/studios/${studioId}/classes/${classId}/restore`),
}

export const memberApi = {
  list: (studioId: string, params?: string) => api.get(`/studios/${studioId}/members${params ? `?${params}` : ''}`),
  get: (studioId: string, memberId: string) => api.get(`/studios/${studioId}/members/${memberId}`),
  addNote: (studioId: string, memberId: string, note: string) => api.post(`/studios/${studioId}/members/${memberId}/notes`, { note }),
  grantComp: (studioId: string, memberId: string, data: unknown) => api.post(`/studios/${studioId}/members/${memberId}/comp`, data),
  suspend: (studioId: string, userId: string) => api.put(`/studios/${studioId}/members/${userId}/suspend`),
  reactivate: (studioId: string, userId: string) => api.put(`/studios/${studioId}/members/${userId}/reactivate`),
  remove: (studioId: string, userId: string) => api.delete(`/studios/${studioId}/members/${userId}`),
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
  restore: (studioId: string, classId: string, bookingId: string) => api.post(`/studios/${studioId}/classes/${classId}/bookings/${bookingId}/restore`),
  privateList: (studioId: string) => api.get(`/studios/${studioId}/private-bookings`),
  privateCreate: (studioId: string, data: unknown) => api.post(`/studios/${studioId}/private-bookings`, data),
  privateUpdate: (studioId: string, bookingId: string, data: unknown) => api.put(`/studios/${studioId}/private-bookings/${bookingId}`, data),
}

export const reportApi = {
  overview: (studioId: string) => api.get<{ activeMembers: number; totalRevenue: number; avgAttendanceRate: number; retentionRate: number }>(`/studios/${studioId}/reports/overview`),
  attendance: (studioId: string, params?: string) => api.get<{ attendance: Array<{ week: string; classes: number; checkins: number; rate: number }> }>(`/studios/${studioId}/reports/attendance${params ? `?${params}` : ''}`),
  revenue: (studioId: string, params?: string) => api.get<{ revenue: Array<{ month: string; revenue: number; memberships: number; dropins: number; packs: number }> }>(`/studios/${studioId}/reports/revenue${params ? `?${params}` : ''}`),
  popular: (studioId: string) => api.get<{ classes: Array<{ name: string; avgAttendance: number; capacity: number; fillRate: number }> }>(`/studios/${studioId}/reports/popular-classes`),
  atRisk: (studioId: string) => api.get<{ members: Array<{ name: string; email: string; lastClass: string | null }> }>(`/studios/${studioId}/reports/at-risk`),
}

export const inviteApi = {
  send: (studioId: string, data: { email: string; name?: string; role?: string }) => api.post(`/studios/${studioId}/members/invite`, data),
}

export const notificationApi = {
  list: () => api.get<{ notifications: Array<{ id: string; type: string; title: string; body: string; sent_at: string; read_at: string | null }> }>('/my/notifications'),
  count: () => api.get<{ unreadCount: number }>('/my/notifications/count'),
  markRead: (id: string) => api.post(`/my/notifications/${id}/read`),
  markAllRead: () => api.post('/my/notifications/read-all'),
}

export const checkinApi = {
  getRoster: (classId: string) => api.get(`/classes/${classId}/roster`),
  batchCheckin: (classId: string, userIds: string[]) => api.post(`/classes/${classId}/batch-checkin`, { userIds }),
  addWalkin: (classId: string, data: unknown) => api.post(`/classes/${classId}/walkin`, data),
  completeClass: (classId: string) => api.post(`/classes/${classId}/complete`),
}

export const feedApi = {
  getClassFeed: (classId: string, params?: string) => api.get(`/classes/${classId}/feed${params ? `?${params}` : ''}`),
  createPost: (classId: string, data: unknown) => api.post(`/classes/${classId}/feed`, data),
  react: (postId: string, reaction: string) => api.post(`/feed/${postId}/react`, { reaction }),
}

export const stripeApi = {
  onboard: (studioId: string) => api.post(`/studios/${studioId}/stripe/onboard`),
  status: (studioId: string) => api.get<{ connected: boolean; accountId?: string; dashboardUrl?: string }>(`/studios/${studioId}/stripe/status`),
  refreshLink: (studioId: string) => api.post<{ url: string }>(`/studios/${studioId}/stripe/refresh-link`),
}

export const subscriptionApi = {
  getMy: (studioId: string) => api.get(`/studios/${studioId}/my-subscription`),
  cancel: (studioId: string) => api.post(`/studios/${studioId}/my-subscription/cancel`),
  pause: (studioId: string) => api.post(`/studios/${studioId}/my-subscription/pause`),
}

export const networkApi = {
  list: (studioId: string) => api.get<{ networks: Array<{ id: string; name: string; description: string | null; status: string; created_by_studio_id: string | null }> }>(`/studios/${studioId}/networks`),
  create: (studioId: string, data: { name: string; description?: string }) => api.post<{ network: { id: string; name: string } }>(`/studios/${studioId}/networks`, data),
  invite: (networkId: string, studioId: string) => api.post(`/networks/${networkId}/invite`, { studioId }),
  accept: (networkId: string, studioId: string) => api.post(`/networks/${networkId}/accept`, { studioId }),
  decline: (networkId: string, studioId: string) => api.post(`/networks/${networkId}/decline`, { studioId }),
  updatePolicy: (networkId: string, studioId: string, policy: { allow_cross_booking?: boolean; credit_sharing?: boolean }) => api.put(`/networks/${networkId}/policy`, { studioId, ...policy }),
  partnerStudios: (studioId: string) => api.get<{ studios: Array<{ id: string; name: string; slug: string; discipline: string }> }>(`/studios/${studioId}/network-studios`),
}

export const migrateApi = {
  upload: (studioId: string, csv: string) => api.post<{ preview: { totalRows: number; validRows: number; invalidRows: number; columns: Array<{ source: string; target: string; required: boolean }>; sampleRows: Array<{ data: Record<string, string>; valid: boolean; errors: string[] }> } }>(`/studios/${studioId}/migrate/upload`, { csv }),
  preview: (studioId: string, csv: string, columns: Array<{ source: string; target: string; required: boolean }>) => api.post<{ preview: { totalRows: number; validRows: number; invalidRows: number; columns: Array<{ source: string; target: string; required: boolean }>; sampleRows: Array<{ data: Record<string, string>; valid: boolean; errors: string[] }> } }>(`/studios/${studioId}/migrate/preview`, { csv, columns }),
  execute: (studioId: string, csv: string, columns: Array<{ source: string; target: string; required: boolean }>) => api.post<{ result: { totalProcessed: number; created: number; skipped: number; failed: number; errors: Array<{ row: number; email: string; error: string }> } }>(`/studios/${studioId}/migrate/execute`, { csv, columns }),
  status: (studioId: string) => api.get<{ status: string; lastImport: unknown }>(`/studios/${studioId}/migrate/status`),
}

export { ApiError }
