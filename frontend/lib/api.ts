// Tiny API client for the OpenVault backend (Django REST at :8000).
// Auto-detects the backend on the same host so it works from localhost AND
// from a LAN IP with zero config. Override with NEXT_PUBLIC_API_URL.

function detectBase(): string {
  const env = process.env.NEXT_PUBLIC_API_URL
  if (env && env.trim()) return env.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`
  }
  // SSR fallback; real calls happen client-side after hydration.
  return 'http://localhost:8000'
}

export const API_BASE = detectBase()

const TOKEN_KEY = 'securekb_token'

export const getToken = (): string | null =>
  typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const t = getToken()
  return t ? { ...extra, Authorization: `Bearer ${t}` } : extra
}

async function handle(res: Response) {
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

export const api = {
  get: (path: string) =>
    fetch(`${API_BASE}/api${path}`, { headers: authHeaders() }).then(handle),
  post: (path: string, body?: unknown) =>
    fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {}),
    }).then(handle),
  put: (path: string, body?: unknown) =>
    fetch(`${API_BASE}/api${path}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {}),
    }).then(handle),
  del: (path: string) =>
    fetch(`${API_BASE}/api${path}`, { method: 'DELETE', headers: authHeaders() }).then(handle),
  upload: (path: string, formData: FormData) =>
    fetch(`${API_BASE}/api${path}`, { method: 'POST', headers: authHeaders(), body: formData }).then(handle),
}

// One NDJSON line from POST /api/ask. The backend streams a `sources` line,
// then many `token` deltas, then `done` — or a single `error` (still HTTP 200).
export type AskEvent =
  | { type: 'sources'; sources: string[] }
  | { type: 'token'; token: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

// Ask the RAG assistant and stream the answer back line by line. `onEvent` is
// called for every parsed event; pass an AbortSignal to let the caller stop it.
export async function askStream(
  question: string,
  onEvent: (e: AskEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ question }),
    signal,
  })
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
export type Role = 'public' | 'admin' | 'employee' | 'viewer'

// Common job titles offered in the dropdowns. These are display labels only and
// do NOT affect permissions (which are governed by Role).
export const JOB_TITLES = [
  'CEO', 'CTO', 'CFO', 'COO', 'Founder', 'HR', 'Manager',
  'Team Lead', 'Engineer', 'Analyst', 'Other',
] as const

// The caller's own company profile (null for consumer/public accounts).
export interface CompanyProfile {
  id: number
  name: string
  slug: string
  website: string
  contact_email: string
  phone: string
  max_employees: number | null
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
}

export interface AuthResponse {
  token: string
  user: User
}

// ---- Auth endpoints ------------------------------------------------------
export const authApi = {
  me: (): Promise<User> => api.get('/auth/me'),

  // Consumer (public): sign in with USERNAME.
  publicRegister: (p: { username: string; email: string; password: string }): Promise<AuthResponse> =>
    api.post('/public/register', p),
  publicLogin: (p: { username: string; password: string }): Promise<AuthResponse> =>
    api.post('/public/login', p),

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
}

// ---- Public documents / browse ------------------------------------------
export interface DocCard {
  id: number
  filename: string
  size: number
  category: string
  description: string
  downloads: number
  company: string
  company_slug: string
  created_at: string
  preview?: string
  favorited?: boolean
}

export interface Category {
  name: string
  count: number
}

export interface Company {
  id: number
  name: string
  slug: string
}

export interface BrowseParams {
  q?: string
  category?: string
  company?: string // slug
  sort?: 'recent' | 'popular'
}

function qs(params: BrowseParams): string {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.category) sp.set('category', params.category)
  if (params.company) sp.set('company', params.company)
  if (params.sort) sp.set('sort', params.sort)
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export const docsApi = {
  list: (params: BrowseParams = {}): Promise<DocCard[]> =>
    api.get(`/public/documents${qs(params)}`),
  detail: (id: number | string): Promise<DocCard> => api.get(`/public/documents/${id}`),
  categories: (): Promise<Category[]> => api.get('/public/categories'),
  companies: (): Promise<Company[]> => api.get('/public/companies'),
  favorites: (): Promise<DocCard[]> => api.get('/favorites'),
  addFavorite: (id: number): Promise<{ favorited: boolean }> => api.post(`/favorites/${id}`),
  removeFavorite: (id: number): Promise<null> => api.del(`/favorites/${id}`),
}

// Authenticated file download: fetch with the bearer token, then trigger a
// browser "save" so the gated endpoint's Authorization header is sent.
export async function downloadDocument(id: number, filename: string) {
  const res = await fetch(`${API_BASE}/api/public/documents/${id}/download`, {
    headers: authHeaders(),
  })
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

// ---- Enterprise workspace (authenticated, tenant-scoped) -----------------
// Full document objects for the caller's OWN company; includes private docs
// (is_public=false), unlike the public portal. Shape = DocumentSerializer.
export interface EnterpriseDoc {
  id: number
  filename: string
  content_type: string
  size: number
  category: string
  description: string
  downloads: number
  is_public: boolean
  is_okf: boolean
  num_chunks: number
  created_at: string
  company_name?: string
}

// One row of the company audit trail (GET /admin/audit, last 200).
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
}

// A document from ANOTHER company shared directly with the current user
// (granular cross-company collaboration). Shape = DocumentSerializer + extras.
export interface SharedDoc extends EnterpriseDoc {
  shared_by: string | null
  can_download: boolean
}

// One grantee on a document the caller's company owns (GET .../shares).
export interface DocumentShareRow {
  id: number
  user_id: number
  email: string
  full_name: string
  company_name: string | null
  can_download: boolean
  created_at: string
}

export type LlmProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini'

// Platform LLM settings (admin Settings page). api_key is write-only on the
// backend: reads only tell you whether one is set via has_api_key.
export interface LlmConfig {
  provider: LlmProvider
  chat_model: string
  base_url: string
  temperature: number
  max_tokens: number
  has_api_key: boolean
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
  email: string
  password: string
  role: Exclude<Role, 'public'>
}

// Company documents. list/download work for any member; upload, the
// publish/unpublish toggle and delete require an editor (admin or employee).
export const workApi = {
  documents: (): Promise<EnterpriseDoc[]> => api.get('/documents'),
  upload: (form: FormData): Promise<EnterpriseDoc> => api.upload('/documents/upload', form),
  togglePublic: (id: number): Promise<EnterpriseDoc> => api.post(`/documents/${id}`),
  remove: (id: number): Promise<null> => api.del(`/documents/${id}`),
  llmStatus: (): Promise<LlmStatus> => api.get('/llm-status'),
  // Documents other companies shared directly with me (cross-company collab).
  sharedWithMe: (): Promise<SharedDoc[]> => api.get('/shared-with-me'),
}

// Granular cross-company sharing. Editors of the OWNING company manage who,
// outside their company, can access one specific document.
export const shareApi = {
  list: (docId: number): Promise<DocumentShareRow[]> => api.get(`/documents/${docId}/shares`),
  add: (docId: number, email: string): Promise<DocumentShareRow> =>
    api.post(`/documents/${docId}/shares`, { email }),
  remove: (docId: number, userId: number): Promise<null> =>
    api.del(`/documents/${docId}/shares/${userId}`),
}

// Platform LLM provider settings + connectivity test (admin only).
export const settingsApi = {
  llmConfig: (): Promise<LlmConfig> => api.get('/admin/llm-config'),
  updateLlmConfig: (p: LlmConfigUpdate): Promise<LlmConfig> => api.put('/admin/llm-config', p),
  llmTest: (): Promise<LlmTestResult> => api.post('/admin/llm-test'),
}

// Company administration: every call requires the caller to be an admin.
export const adminApi = {
  users: (): Promise<User[]> => api.get('/admin/users'),
  createUser: (p: NewUser): Promise<User> => api.post('/admin/users', p),
  removeUser: (id: number): Promise<null> => api.del(`/admin/users/${id}`),
  audit: (): Promise<AuditRow[]> => api.get('/admin/audit'),
}

// Authenticated download of a company-owned document (public OR private),
// via the tenant-scoped endpoint (distinct from the public portal one above).
export async function downloadOwnDocument(id: number, filename: string) {
  const res = await fetch(`${API_BASE}/api/documents/${id}/download`, {
    headers: authHeaders(),
  })
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

