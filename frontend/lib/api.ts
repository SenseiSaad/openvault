// Tiny API client for the SecureKB / F5P backend (Django REST at :8000).
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
  del: (path: string) =>
    fetch(`${API_BASE}/api${path}`, { method: 'DELETE', headers: authHeaders() }).then(handle),
  upload: (path: string, formData: FormData) =>
    fetch(`${API_BASE}/api${path}`, { method: 'POST', headers: authHeaders(), body: formData }).then(handle),
}

// ---- Types ---------------------------------------------------------------
export type Role = 'public' | 'admin' | 'employee' | 'viewer'

export interface User {
  id: number
  email: string
  username: string | null
  full_name: string
  role: Role
  company_id: number | null
}

export interface AuthResponse {
  token: string
  user: User
}

// ---- Auth endpoints ------------------------------------------------------
export const authApi = {
  me: (): Promise<User> => api.get('/auth/me'),

  // Consumer (public) — sign in with USERNAME.
  publicRegister: (p: { username: string; email: string; password: string }): Promise<AuthResponse> =>
    api.post('/public/register', p),
  publicLogin: (p: { username: string; password: string }): Promise<AuthResponse> =>
    api.post('/public/login', p),

  // Enterprise — sign in with EMAIL.
  enterpriseLogin: (p: { email: string; password: string }): Promise<AuthResponse> =>
    api.post('/auth/login', p),
  enterpriseRegister: (p: {
    company_name: string
    admin_name?: string
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

