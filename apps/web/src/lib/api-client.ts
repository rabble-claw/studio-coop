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
  getSettings: (studioId: string) => api.get<{ studioId: string; general: Record<string, unknown>; notifications: Record<string, unknown>; cancellation: Record<string, unknown>; waitlist: Record<string, unknown> }>(`/studios/${studioId}/settings`),
  updateGeneral: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/general`, data),
  updateNotifications: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/notifications`, data),
  updateCancellation: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/cancellation`, data),
  updateWaitlist: (studioId: string, data: unknown) => api.put(`/studios/${studioId}/settings/waitlist`, data),
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

export interface PrivacySettings {
  profile_visibility: 'everyone' | 'members' | 'staff_only'
  show_attendance: boolean
  show_email: boolean
  show_phone: boolean
  show_achievements: boolean
  feed_posts_visible: boolean
}

export const memberApi = {
  list: (studioId: string, params?: string) => api.get(`/studios/${studioId}/members${params ? `?${params}` : ''}`),
  get: (studioId: string, memberId: string) => api.get(`/studios/${studioId}/members/${memberId}`),
  addNote: (studioId: string, memberId: string, note: string) => api.post(`/studios/${studioId}/members/${memberId}/notes`, { note }),
  grantComp: (studioId: string, memberId: string, data: unknown) => api.post(`/studios/${studioId}/members/${memberId}/comp`, data),
  suspend: (studioId: string, userId: string) => api.put(`/studios/${studioId}/members/${userId}/suspend`),
  reactivate: (studioId: string, userId: string) => api.put(`/studios/${studioId}/members/${userId}/reactivate`),
  remove: (studioId: string, userId: string) => api.delete(`/studios/${studioId}/members/${userId}`),
  revokeComp: (studioId: string, compId: string) => api.delete(`/studios/${studioId}/comps/${compId}`),
  getPrivacy: (studioId: string, memberId: string) => api.get<PrivacySettings>(`/studios/${studioId}/members/${memberId}/privacy`),
  updatePrivacy: (studioId: string, memberId: string, settings: Partial<PrivacySettings>) => api.put<PrivacySettings>(`/studios/${studioId}/members/${memberId}/privacy`, settings),
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
  teacherStats: (studioId: string, teacherId: string) => api.get<{
    classesTaught: number
    avgAttendance: number
    avgFillRate: number
    weeklyTrend: Array<{ week: string; classes: number; avgAttendance: number; avgFillRate: number }>
    topClasses: Array<{ name: string; timesTaught: number; avgAttendance: number; fillRate: number }>
  }>(`/studios/${studioId}/reports/teacher/${teacherId}`),
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

export const achievementApi = {
  list: (studioId: string) => api.get<{ achievements: Array<{ id: string; title: string; description: string | null; category: string; icon: string; earned_at: string; feed_post_id: string | null; created_at: string; user: { id: string; name: string; avatar_url: string | null } }> }>(`/studios/${studioId}/achievements`),
  memberAchievements: (studioId: string, memberId: string) => api.get<{ achievements: Array<{ id: string; title: string; description: string | null; category: string; icon: string; earned_at: string; feed_post_id: string | null; created_at: string }> }>(`/studios/${studioId}/achievements/member/${memberId}`),
  create: (studioId: string, data: { title: string; description?: string; category?: string; icon?: string; share_to_feed?: boolean; user_id?: string }) => api.post<{ achievement: { id: string; title: string; description: string | null; category: string; icon: string; earned_at: string } }>(`/studios/${studioId}/achievements`, data),
  remove: (studioId: string, achievementId: string) => api.delete<{ ok: boolean }>(`/studios/${studioId}/achievements/${achievementId}`),
}

export const skillApi = {
  list: (studioId: string) => api.get<{ skills: Array<{ id: string; name: string; category: string; description: string | null; sort_order: number }>; grouped: Record<string, Array<{ id: string; name: string; category: string; description: string | null; sort_order: number }>> }>(`/studios/${studioId}/skills`),
  create: (studioId: string, data: { name: string; category: string; description?: string; sort_order?: number }) => api.post<{ skill: { id: string; name: string; category: string; description: string | null; sort_order: number } }>(`/studios/${studioId}/skills`, data),
  update: (studioId: string, skillId: string, data: { name?: string; category?: string; description?: string; sort_order?: number }) => api.put<{ skill: { id: string; name: string; category: string; description: string | null; sort_order: number } }>(`/studios/${studioId}/skills/${skillId}`, data),
  delete: (studioId: string, skillId: string) => api.delete(`/studios/${studioId}/skills/${skillId}`),
  seed: (studioId: string) => api.post<{ seeded: number; skills: Array<{ id: string; name: string; category: string }> }>(`/studios/${studioId}/skills/seed`),
  memberSkills: (studioId: string, memberId: string) => api.get<{ skills: Array<{ id: string; name: string; category: string; description: string | null; level: string | null; notes: string | null; verified_by: string | null; verified_at: string | null; verifier_name: string | null }>; grouped: Record<string, Array<{ id: string; name: string; category: string; level: string | null; verified_by: string | null; verified_at: string | null; verifier_name: string | null }>> }>(`/studios/${studioId}/skills/member/${memberId}`),
  updateLevel: (studioId: string, memberId: string, skillId: string, data: { level: string; notes?: string; verify?: boolean }) => api.put<{ skill: { id: string; skill_id: string; level: string; notes: string | null; verified_by: string | null; verified_at: string | null } }>(`/studios/${studioId}/skills/member/${memberId}/${skillId}`, data),
}

export const subRequestApi = {
  list: (studioId: string, status?: string) => api.get(`/studios/${studioId}/sub-requests${status ? `?status=${status}` : ''}`),
  create: (studioId: string, data: { class_instance_id: string; reason?: string }) => api.post(`/studios/${studioId}/sub-requests`, data),
  accept: (studioId: string, requestId: string) => api.post(`/studios/${studioId}/sub-requests/${requestId}/accept`),
  cancel: (studioId: string, requestId: string) => api.post(`/studios/${studioId}/sub-requests/${requestId}/cancel`),
  my: (studioId: string) => api.get(`/studios/${studioId}/sub-requests/my`),
}

export const migrateApi = {
  upload: (studioId: string, csv: string) => api.post<{ preview: { totalRows: number; validRows: number; invalidRows: number; columns: Array<{ source: string; target: string; required: boolean }>; sampleRows: Array<{ data: Record<string, string>; valid: boolean; errors: string[] }> } }>(`/studios/${studioId}/migrate/upload`, { csv }),
  preview: (studioId: string, csv: string, columns: Array<{ source: string; target: string; required: boolean }>) => api.post<{ preview: { totalRows: number; validRows: number; invalidRows: number; columns: Array<{ source: string; target: string; required: boolean }>; sampleRows: Array<{ data: Record<string, string>; valid: boolean; errors: string[] }> } }>(`/studios/${studioId}/migrate/preview`, { csv, columns }),
  execute: (studioId: string, csv: string, columns: Array<{ source: string; target: string; required: boolean }>) => api.post<{ result: { totalProcessed: number; created: number; skipped: number; failed: number; errors: Array<{ row: number; email: string; error: string }> } }>(`/studios/${studioId}/migrate/execute`, { csv, columns }),
  status: (studioId: string) => api.get<{ status: string; lastImport: unknown }>(`/studios/${studioId}/migrate/status`),
}

export interface Expense {
  id: string
  studio_id: string
  category_id: string | null
  description: string
  amount_cents: number
  date: string
  recurring: boolean
  recurring_interval: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly' | null
  vendor: string | null
  notes: string | null
  created_at: string
  category?: { id: string; name: string; color: string } | null
}

export interface ExpenseCategory {
  id: string
  studio_id: string
  name: string
  color: string
  budget_cents: number | null
}

export interface InstructorComp {
  id: string
  studio_id: string
  user_id: string
  rate_cents: number
  rate_type: 'per_class' | 'hourly' | 'monthly'
  effective_from: string
  effective_to: string | null
  instructor?: { id: string; name: string }
}

export interface FinancialOverview {
  monthly_revenue_cents: number
  monthly_expenses_cents: number
  net_income_cents: number
  profit_margin: number
}

export interface PnlRow {
  month: string
  revenue_cents: number
  expenses_cents: number
  net_cents: number
}

export interface CashFlowRow {
  month: string
  inflows_cents: number
  outflows_cents: number
  net_cents: number
  running_balance_cents: number
}

export interface HealthCheck {
  score: number
  grade: string
  metrics: Array<{
    name: string
    value: string
    status: 'good' | 'warning' | 'critical'
    detail: string
  }>
}

export interface BreakEvenResult {
  break_even_revenue_cents: number
  fixed_costs_cents: number
  variable_cost_ratio: number
  current_revenue_cents: number
  months_to_break_even: number | null
}

export const financeApi = {
  // Expenses
  listExpenses: (studioId: string, params?: string) =>
    api.get<{ expenses: Expense[] }>(`/studios/${studioId}/finances/expenses${params ? `?${params}` : ''}`),
  createExpense: (studioId: string, data: unknown) =>
    api.post<{ expense: Expense }>(`/studios/${studioId}/finances/expenses`, data),
  updateExpense: (studioId: string, expenseId: string, data: unknown) =>
    api.put<{ expense: Expense }>(`/studios/${studioId}/finances/expenses/${expenseId}`, data),
  deleteExpense: (studioId: string, expenseId: string) =>
    api.delete(`/studios/${studioId}/finances/expenses/${expenseId}`),

  // Categories
  listCategories: (studioId: string) =>
    api.get<{ categories: ExpenseCategory[] }>(`/studios/${studioId}/finances/expense-categories`),

  // Instructor compensation
  listInstructors: (studioId: string) =>
    api.get<{ instructors: InstructorComp[] }>(`/studios/${studioId}/finances/instructors`),
  createInstructor: (studioId: string, data: unknown) =>
    api.post<{ instructor: InstructorComp }>(`/studios/${studioId}/finances/instructors`, data),
  updateInstructor: (studioId: string, instructorId: string, data: unknown) =>
    api.put<{ instructor: InstructorComp }>(`/studios/${studioId}/finances/instructors/${instructorId}`, data),
  deleteInstructor: (studioId: string, instructorId: string) =>
    api.delete(`/studios/${studioId}/finances/instructors/${instructorId}`),
  instructorCost: (studioId: string) =>
    api.get<{ total_cents: number; by_instructor: Array<{ user_id: string; name: string; classes: number; total_cents: number }> }>(`/studios/${studioId}/finances/instructors/cost`),

  // Reports
  overview: (studioId: string) =>
    api.get<FinancialOverview>(`/studios/${studioId}/finances/overview`),
  pnl: (studioId: string, params?: string) =>
    api.get<{ months: PnlRow[] }>(`/studios/${studioId}/finances/pnl${params ? `?${params}` : ''}`),
  cashFlow: (studioId: string, params?: string) =>
    api.get<{ months: CashFlowRow[] }>(`/studios/${studioId}/finances/cash-flow${params ? `?${params}` : ''}`),
  healthCheck: (studioId: string) =>
    api.get<HealthCheck>(`/studios/${studioId}/finances/health-check`),
  breakEven: (studioId: string) =>
    api.get<BreakEvenResult>(`/studios/${studioId}/finances/break-even`),

  // Scenario & Setup
  scenario: (studioId: string, data: unknown) =>
    api.post<{ result: unknown }>(`/studios/${studioId}/finances/scenario`, data),
  setup: (studioId: string, data: unknown) =>
    api.post<{ ok: boolean }>(`/studios/${studioId}/finances/setup`, data),
}

export { ApiError }
