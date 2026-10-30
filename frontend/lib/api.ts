// Tiny API client for the OpenVault backend (Django REST at :8000).
// Sessions use HttpOnly cookies: the browser sends them automatically
// (credentials: 'include') and the raw token never touches JS-land, so XSS
// cannot steal it. On a 401 we try one silent refresh then replay the request.

function detectBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env && env.trim()) return env.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    // Local dev runs Django on :8000. Split deployments (Amplify + Render)
    // must set NEXT_PUBLIC_API_URL at build time; without it, production is
    // assumed to use a same-origin reverse proxy.
    const { protocol, hostname, origin } = window.location
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:8000`
    }
    return origin
  }
  // SSR fallback; real calls happen client-side after hydration.
  return 'http://localhost:8000'
}

export const API_BASE = detectBase()

let refreshing: Promise<boolean> | null = null

// Try to renew the access cookie via the refresh cookie. Resolves true on success.
async function tryRefresh(): Promise<boolean> {
  refreshing ||= fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => { refreshing = null }, 50)
    })
  return refreshing
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tiny client: response shapes are typed at each call site
async function handle(res: Response, retry: () => Promise<Response>): Promise<any> {
  if (res.status === 401) {
    // Access token expired: renew once, replay the original request.
    const renewed = await tryRefresh()
    if (renewed) return handle(await retry(), async () => retry())
    throw new Error('Session expired. Please sign in again.')
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      const data = await res.json()
      // DRF returns {detail: "..."} or field-keyed {field: ["msg"]}
      const first = data.detail ?? Object.values(data)[0]
      detail = Array.isArray(first) ? first[0] : first || detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  if (res.status === 204) return null
  return res.json()
}

function request(method: string, path: string, body?: unknown, isForm = false) {
  const run = () =>
    fetch(`${API_BASE}/api${path}`, {
      method,
      credentials: 'include',
      headers: isForm || body == null ? undefined : { 'Content-Type': 'application/json' },
      body: isForm ? (body as FormData) : body == null ? undefined : JSON.stringify(body),
    })
  return run().then((res) => handle(res, run))
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: unknown) => request('POST', path, body),
  patch: (path: string, body?: unknown) => request('PATCH', path, body),
  put: (path: string, body?: unknown) => request('PUT', path, body),
  del: (path: string) => request('DELETE', path),
  upload: (path: string, formData: FormData) => request('POST', path, formData, true),
}

// Outcome of a Google Calendar sync attempt. `created` = a real
// event was booked; `simulated` = credentials absent so it was only prepared.
export interface WorkflowCalendar {
  status: 'created' | 'simulated' | 'error'
  reason?: string
  event_id?: string
  html_link?: string
}

// Outcome of the confirmation email.
export interface WorkflowEmail {
  status: 'sent' | 'skipped' | 'error'
  reason?: string
  recipients?: string[]
}

// A completed workflow action streamed after the assistant detects an intent.
export interface WorkflowResult {
  type: 'workflow'
  action: 'schedule_meeting' | 'leave_request' | string
  status: 'ok' | 'simulated' | 'error' | string
  message: string
  // schedule_meeting
  title?: string
  when?: string
  participants?: string[]
  calendar?: WorkflowCalendar
  email?: WorkflowEmail
  // leave_request
  filename?: string
  download_url?: string
  leave_reason?: string
  leave_date?: string
  // error
  detail?: string
}

// One NDJSON line from POST /api/ask.
export type AskEvent =
  | { type: 'sources'; sources: string[] }
  | { type: 'conversation'; conversation_id: number }
  | { type: 'saved'; message_id: number }
  | { type: 'flag'; message: string; categories: string[] }
  | { type: 'token'; token: string }
  | { type: 'intent'; intent: string; data: Record<string, unknown> }
  | WorkflowResult
  | { type: 'done' }
  | { type: 'error'; message: string }

// Ask the RAG assistant and stream the answer back line by line. `onEvent` is
// called for every parsed event; pass an AbortSignal to let the caller stop it.
export async function askStream(
  question: string,
  onEvent: (e: AskEvent) => void,
  signal?: AbortSignal,
  options?: { mode?: 'local' | 'online'; provider?: string; conversationId?: number | null },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      mode: options?.mode,
      provider: options?.provider,
      conversation_id: options?.conversationId ?? null,
    }),
    signal,
  })
  if (res.status === 401) {
    const renewed = await tryRefresh()
    if (renewed) return askStream(question, onEvent, signal, options)
  }
  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`
    try {
      const d = await res.json()
      detail = d.detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    onEvent({ type: 'error', message: detail })
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const drain = (final: boolean) => {
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim()
      buffer = buffer.slice(nl + 1)
      if (line) {
        try {
          onEvent(JSON.parse(line) as AskEvent)
        } catch {
          /* ignore a partial/garbled line */
        }
      }
    }
    if (final && buffer.trim()) {
      try {
        onEvent(JSON.parse(buffer.trim()) as AskEvent)
      } catch {
        /* ignore */
      }
    }
  }
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    drain(false)
  }
  drain(true)
}

// ---- Types ---------------------------------------------------------------
export type Role = 'admin' | 'employee' | 'viewer'
export type UiLanguage = 'en' | 'ur'

// Common job titles offered in the dropdowns. These are display labels only and
// do NOT affect permissions (which are governed by Role).
export const JOB_TITLES = [
  'CEO', 'CTO', 'CFO', 'COO', 'Founder', 'HR', 'Manager',
  'Team Lead', 'Engineer', 'Analyst', 'Other',
] as const

// Subscription plan (USD pricing; limits enforced server-side).
export interface Plan {
  id: number
  name: string
  price_usd: number
  billing_period: string
  max_members: number | null
  max_documents: number | null
  storage_mb: number | null
  monthly_ask_limit: number | null
  allow_versions: boolean
  allow_departments: boolean
  allow_custom_llm: boolean
  is_default: boolean
}

export interface Department {
  id: number
  name: string
  member_count: number
  created_at: string
}

// The caller's own company profile (null for platform admins with no company).
export interface CompanyProfile {
  id: number
  name: string
  slug: string
  access_code: string | null
  website: string
  contact_email: string
  phone: string
  max_employees: number | null
  plan: Plan | null
}

export interface User {
  id: number
  email: string
  username: string | null
  full_name: string
  title: string // display job title (CEO/CTO/HR/...), not a permission
  role: Role
  company_id: number | null
  company: CompanyProfile | null
  department_id: number | null
  department_name: string | null
  email_verified?: boolean
  language?: UiLanguage
  is_active?: boolean
  is_platform_admin?: boolean
  is_superuser?: boolean
}

export interface AuthResponse {
  user: User
}

// ---- Auth endpoints ------------------------------------------------------
export const authApi = {
  me: (): Promise<User> => api.get('/auth/me'),
  // Enterprise: sign in with EMAIL.
  enterpriseLogin: (p: { email: string; password: string }): Promise<AuthResponse> =>
    api.post('/auth/login', p),
  enterpriseRegister: (p: {
    company_name: string
    admin_name?: string
    admin_title?: string
    website?: string
    contact_email?: string
    phone?: string
    max_employees?: number | null
    email: string
    password: string
  }): Promise<AuthResponse> => api.post('/auth/register', p),
  logout: (): Promise<{ ok: boolean }> => api.post('/auth/logout'),
  updateMe: (p: { full_name?: string; title?: string; language?: UiLanguage; current_password?: string; new_password?: string }): Promise<User> =>
    api.patch('/auth/update-me', p),
  requestVerification: (email: string): Promise<{ detail: string }> =>
    api.post('/auth/request-verification', { email }),
  verifyEmail: (token: string): Promise<{ detail: string }> =>
    api.post('/auth/verify', { token }),
  forgotPassword: (email: string): Promise<{ detail: string }> =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string): Promise<{ detail: string }> =>
    api.post('/auth/reset-password', { token, password }),
}

// ---- Registered-company directory ---------------------------------------
export interface CompanyDirectory {
  id: number
  name: string
  access_code: string
  member_count: number
}

export interface MemberDirectory {
  id: number
  email: string
  full_name: string
  title: string
  role: Role
}

export const companyApi = {
  search: (accessCode: string): Promise<CompanyDirectory> =>
    api.get(`/companies/search?code=${encodeURIComponent(accessCode)}`),
  members: (accessCode: string): Promise<MemberDirectory[]> =>
    api.get(`/companies/${encodeURIComponent(accessCode)}/members`),
}

// ---- Enterprise workspace (authenticated, tenant-scoped) -----------------
export interface EnterpriseDoc {
  id: number
  filename: string
  content_type: string
  size: number
  category: string
  description: string
  downloads: number
  is_okf: boolean
  access_scope: 'company' | 'restricted' | 'department'
  department: number | null
  department_name: string | null
  tags: string[]
  indexing_status: 'pending' | 'ready' | 'failed'
  index_error: string
  num_chunks: number
  version: number
  created_at: string
  updated_at: string
  company_name?: string
}

// Paginated list envelope returned by the documents endpoint.
export interface Paged<T> {
  results: T[]
  count: number
  page: number
  pages: number
}

// One row of the company audit trail.
export interface AuditRow {
  id: number
  user_id: number | null
  action: string
  detail: string
  ip: string
  created_at: string
}

export interface LlmStatus {
  online: boolean
  provider?: string
  model: string
  company_override?: boolean
  key_source?: 'platform_env' | 'company' | 'row' | 'iam' | 'none'
  local?: {
    online: boolean
    provider: string
    model: string
  }
  online_api?: {
    online: boolean
    provider: string
    model: string
    has_key: boolean
  }
}

// A document from ANOTHER company shared directly with the current user.
export interface SharedDoc extends EnterpriseDoc {
  shared_by: string | null
  can_download: boolean
}

// One grantee on a document the caller's company owns.
export interface DocumentShareRow {
  id: number
  user_id: number
  email: string
  full_name: string
  title: string
  role: Role
  company_name: string | null
  access_code: string | null
  can_download: boolean
  created_at: string
}

// Read legacy provider values from existing database rows, while the settings
// UI only offers the two supported launch modes.
export type LlmProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'bedrock'

// LLM settings: the platform default (platform admins) or a company override.
export interface LlmConfig {
  provider: LlmProvider
  chat_model: string
  base_url: string
  temperature: number
  max_tokens: number
  has_api_key: boolean
  is_company_override: boolean
  key_source?: 'platform_env' | 'company' | 'row' | 'iam' | 'none'
  platform_key_in_use?: boolean
  updated_at: string
}

export interface LlmConfigUpdate {
  provider?: LlmProvider
  chat_model?: string
  base_url?: string
  temperature?: number
  max_tokens?: number
  api_key?: string
}

export interface LlmTestResult {
  ok: boolean
  provider: string
  model: string
  sample?: string
  detail?: string
}

export interface NewUser {
  full_name?: string
  title?: string
  department_id?: number | null
  email: string
  password: string
  role: Role
}

// Company documents. Access is filtered server-side; upload/delete/share
// require an editor (admin or employee).
export const workApi = {
  documents: (page = 1, pageSize = 200): Promise<Paged<EnterpriseDoc>> =>
    api.get(`/documents?page=${page}&page_size=${pageSize}`),
  upload: async (form: FormData): Promise<EnterpriseDoc> => {
    const file = form.get('file')
    // On Vercel serverless, bodies > 4.5 MB are rejected; try direct S3 presigned upload when file > 4 MB.
    if (file instanceof File && file.size > 4 * 1024 * 1024) {
      try {
        const presign = await api.post('/documents/presign', {
          filename: file.name,
          size: file.size,
          content_type: file.type || 'application/octet-stream',
        })
        if (presign?.upload_url && presign?.key) {
          const putRes = await fetch(presign.upload_url, {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          })
          if (putRes.ok) {
            return api.post('/documents/confirm', {
              key: presign.key,
              filename: file.name,
              size: file.size,
              content_type: file.type || '',
              category: form.get('category') ?? 'Other',
              description: form.get('description') ?? '',
              tags: form.get('tags') ?? '',
              is_okf: form.get('is_okf') ?? 'false',
              access_scope: form.get('access_scope') ?? 'company',
              department_id: form.get('department_id') ?? null,
            })
          }
        }
      } catch {
        // Fall back to standard multipart upload if S3 presigning is not enabled.
      }
    }
    return api.upload('/documents/upload', form)
  },
  docDetail: (id: number): Promise<EnterpriseDoc> => api.get(`/documents/${id}`),
  updateDoc: (id: number, p: Partial<EnterpriseDoc>): Promise<EnterpriseDoc> =>
    api.patch(`/documents/${id}`, p),
  remove: (id: number): Promise<null> => api.del(`/documents/${id}`),
  reindex: (id: number): Promise<EnterpriseDoc> => api.post(`/documents/${id}/reindex`),
  preview: (id: number): Promise<{ id: number; filename: string; text: string; truncated: boolean; num_chunks: number }> =>
    api.get(`/documents/${id}/preview`),
  versions: (id: number): Promise<{ id: number; version_number: number; filename: string; size: number; created_at: string }[]> =>
    api.get(`/documents/${id}/versions`),
  newVersion: (id: number, form: FormData): Promise<EnterpriseDoc> =>
    api.upload(`/documents/${id}/versions/new`, form),
  llmStatus: (): Promise<LlmStatus> => api.get('/llm-status'),
  // Documents other companies shared directly with me (cross-company collab).
  sharedWithMe: (): Promise<SharedDoc[]> => api.get('/shared-with-me'),
}

// Granular cross-company sharing. Editors of the OWNING company manage who,
// outside their company, can access one specific document.
export const shareApi = {
  list: (docId: number): Promise<DocumentShareRow[]> => api.get(`/documents/${docId}/shares`),
  add: (docId: number, payload: { access_code: string; user_id: number; can_download?: boolean }): Promise<DocumentShareRow> =>
    api.post(`/documents/${docId}/shares`, payload),
  remove: (docId: number, userId: number): Promise<null> =>
    api.del(`/documents/${docId}/shares/${userId}`),
}

// Company settings (admin): profile + seat cap.
export const companyApi2 = {
  settings: (): Promise<CompanyProfile> => api.get('/admin/company'),
  updateSettings: (p: Partial<Pick<CompanyProfile, 'name' | 'website' | 'contact_email' | 'phone' | 'max_employees'>>): Promise<CompanyProfile> =>
    api.patch('/admin/company', p),
  departments: (): Promise<Department[]> => api.get('/admin/departments'),
  addDepartment: (name: string): Promise<Department> => api.post('/admin/departments', { name }),
  removeDepartment: (id: number): Promise<null> => api.del(`/admin/departments/${id}`),
  announcements: (): Promise<Announcement[]> => api.get('/admin/announcements'),
  addAnnouncement: (p: { title: string; body: string }): Promise<Announcement> =>
    api.post('/admin/announcements', p),
  removeAnnouncement: (id: number): Promise<null> => api.del(`/admin/announcements/${id}`),
}

// Platform LLM provider settings + connectivity test.
export const settingsApi = {
  llmConfig: (): Promise<LlmConfig> => api.get('/admin/llm-config'),
  updateLlmConfig: (p: LlmConfigUpdate): Promise<LlmConfig> => api.put('/admin/llm-config', p),
  resetLlmConfig: (): Promise<LlmConfig> => api.del('/admin/llm-config'),
  llmTest: (): Promise<LlmTestResult> => api.post('/admin/llm-test'),
}

// Chat threads (persisted history + ratings).
export interface Conversation {
  id: number
  title: string
  message_count: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources: string[]
  rating: number | null
  created_at: string
}

export const chatApi = {
  conversations: (): Promise<Paged<Conversation>> => api.get('/conversations?page_size=50'),
  newConversation: (title?: string): Promise<Conversation> => api.post('/conversations', { title }),
  messages: (id: number): Promise<{ conversation: Conversation; messages: ChatMessage[] }> =>
    api.get(`/conversations/${id}`),
  remove: (id: number): Promise<null> => api.del(`/conversations/${id}`),
  rename: (id: number, title: string): Promise<Conversation> => api.patch(`/conversations/${id}`, { title }),
  rate: (messageId: number, rating: 1 | -1): Promise<{ ok: boolean }> =>
    api.post(`/messages/${messageId}/rate`, { rating }),
}

// Usage analytics (company admin).
export interface Analytics {
  range_days: number
  totals: { asks: number; unanswered: number; flagged: number; avg_latency_ms: number }
  by_user: { user__email: string | null; user__full_name: string | null; asks: number; unanswered: number }[]
  by_department: { department__name: string; asks: number; unanswered: number }[]
  unanswered_questions: { question: string; created_at: string; user__email: string | null }[]
  ratings: { up: number; down: number }
  top_documents: { filename: string; downloads: number }[]
  usage: { asks_this_month: number; monthly_ask_limit: number | null }
}

export const analyticsApi = {
  get: (days = 30): Promise<Analytics> => api.get(`/admin/analytics?days=${days}`),
}

// Usage & plan dashboard (company admin): current consumption of every plan
// quota this month plus the upgrade catalogue.
export interface UsageReport {
  plan: Plan
  usage: {
    asks: { used: number; limit: number | null; remaining: number | null }
    documents: { used: number; limit: number | null; remaining: number | null }
    storage: { used_bytes: number; limit_mb: number | null; used_mb: number }
    members: { used: number; limit: number | null; remaining: number | null }
    departments: { used: number; enabled: boolean }
  }
  upgrades: Plan[]
}

export const usageApi = {
  get: (): Promise<UsageReport> => api.get('/admin/usage'),
}

export interface AdminCompany {
  id: number
  name: string
  slug: string
  access_code: string
  member_count: number
  doc_count: number
  plan: Plan | null
}

// Company administration: requires admin/platform authority.
export const adminApi = {
  users: (): Promise<User[]> => api.get('/admin/users'),
  createUser: (p: NewUser): Promise<User> => api.post('/admin/users', p),
  updateUser: (id: number, p: { role?: Role; department_id?: number | null; full_name?: string; title?: string; is_active?: boolean }): Promise<User> =>
    api.patch(`/admin/users/${id}`, p),
  removeUser: (id: number): Promise<null> => api.del(`/admin/users/${id}`),
  audit: (page = 1, pageSize = 200): Promise<Paged<AuditRow>> =>
    api.get(`/admin/audit?page=${page}&page_size=${pageSize}`),
  exportAudit: () => `${API_BASE}/api/admin/audit?export=csv`,
  companies: (): Promise<AdminCompany[]> => api.get('/admin/companies'),
  switchCompany: (company_id: number): Promise<User> => api.post('/admin/switch-company', { company_id }),
  detachCompany: (): Promise<User> => api.post('/admin/detach-company'),
  setCompanyPlan: (companyId: number, planId: number): Promise<{ ok: boolean }> =>
    api.post(`/admin/companies/${companyId}/plan`, { plan_id: planId }),
  plans: (): Promise<Plan[]> => {
    // plans is AllowAny but goes through the same client for consistency
    return api.get('/plans')
  },
}

// ---- Attendance + 3-strike discipline (Feature 5) ------------------------
export interface AttendanceRecord {
  id: number
  date: string
  scanned_at: string
  status: string
}

export interface UserStrike {
  absent_count: number
  strikes: number
  is_frozen: boolean
  last_evaluated_period: string | null
  last_updated: string
}

export interface AttendanceMe {
  today: string
  marked_today: boolean
  absences_this_month: number
  records: AttendanceRecord[]
  strike: UserStrike | null
}

export interface AttendanceQr {
  target: string
  svg: string | null
  qr_available: boolean
}

export const attendanceApi = {
  me: (): Promise<AttendanceMe> => api.get('/attendance/me'),
  // 201 with the new record, or throws "Attendance already marked for today." (409).
  scan: (): Promise<AttendanceRecord> => api.post('/attendance/scan'),
  qr: (): Promise<AttendanceQr> => api.get('/attendance/qr'),
}

export interface Announcement {
  id: number
  title: string
  body: string
  created_by_name: string | null
  created_at: string
}

// Authenticated download of a permitted enterprise document.
export async function downloadOwnDocument(id: number, filename: string) {
  const res = await fetch(`${API_BASE}/api/documents/${id}/download`, { credentials: 'include' })
  if (res.status === 401) {
    const renewed = await tryRefresh()
    if (renewed) return downloadOwnDocument(id, filename)
  }
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || 'document'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Authenticated download of an AI-generated workflow form (e.g. the leave
// application .docx). `downloadUrl` may be relative or absolute.
export async function downloadGeneratedForm(downloadUrl: string, filename?: string) {
  const url = /^https?:\/\//i.test(downloadUrl) ? downloadUrl : `${API_BASE}${downloadUrl}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename || 'Leave_Application.docx'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}
