'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi, clearToken, getToken, setToken, type AuthResponse, type User } from './api'

interface AuthContextValue {
  user: User | null
  loading: boolean // true while restoring the session on first load
  isEnterprise: boolean
  publicLogin: (username: string, password: string) => Promise<User>
  publicRegister: (p: { username: string; email: string; password: string }) => Promise<User>
  enterpriseLogin: (email: string, password: string) => Promise<User>
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
  }) => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore the session from a stored token on first mount.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearToken()) // token expired/invalid
      .finally(() => setLoading(false))
  }, [])

  const apply = useCallback((res: AuthResponse) => {
    setToken(res.token)
    setUser(res.user)
    return res.user
  }, [])

  const publicLogin = useCallback(
    (username: string, password: string) =>
      authApi.publicLogin({ username, password }).then(apply),
    [apply],
  )
  const publicRegister = useCallback(
    (p: { username: string; email: string; password: string }) =>
      authApi.publicRegister(p).then(apply),
    [apply],
  )
  const enterpriseLogin = useCallback(
    (email: string, password: string) => authApi.enterpriseLogin({ email, password }).then(apply),
    [apply],
  )
  const enterpriseRegister = useCallback(
    (p: {
      company_name: string
      admin_name?: string
      admin_title?: string
      website?: string
      contact_email?: string
      phone?: string
      max_employees?: number | null
      email: string
      password: string
    }) => authApi.enterpriseRegister(p).then(apply),
    [apply],
  )
  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isEnterprise: !!user && user.role !== 'public',
        publicLogin,
        publicRegister,
        enterpriseLogin,
        enterpriseRegister,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
