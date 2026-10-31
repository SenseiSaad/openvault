'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import {
  authApi, isMfaResponse, type AuthResponse, type MfaLoginResponse, type User, type UiLanguage,
} from './api'

export interface MfaStep {
  kind: 'activate' | 'verify'
  challenge: string
  enrollment?: { secret: string; uri: string }
}

interface AuthContextValue {
  user: User | null
  loading: boolean // true while restoring the session on first load
  isEnterprise: boolean
  isPlatformAdmin: boolean
  language: UiLanguage
  setLanguage: (lang: UiLanguage) => Promise<void>
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
  completeMfa: (step: MfaStep, code: string) => Promise<User>
  refreshUser: () => Promise<User | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The session lives in HttpOnly cookies: ask the server who we are.
  // A 401 triggers one silent refresh inside the API client automatically.
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const apply = useCallback((res: AuthResponse) => {
    setUser(res.user)
    return res.user
  }, [])

  const enterpriseLogin = useCallback(
    (email: string, password: string) =>
      authApi.enterpriseLogin({ email, password }).then((res) => {
        // Platform admins must finish a TOTP step; surface it as a typed error
        // the login form can catch and turn into a code input.
        if (isMfaResponse(res)) {
          const err = new Error('mfa_required') as Error & { mfa?: MfaLoginResponse }
          err.mfa = res
          throw err
        }
        return apply(res)
      }),
    [apply],
  )

  const completeMfa = useCallback(
    async (step: MfaStep, code: string) =>
      apply(step.kind === 'activate'
        ? await authApi.mfaActivate(step.challenge, code)
        : await authApi.mfaVerify(step.challenge, code)),
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
  const refreshUser = useCallback(() => {
    return authApi
      .me()
      .then((u) => {
        setUser(u)
        return u
      })
      .catch(() => null)
  }, [])

  const setLanguage = useCallback(
    async (lang: UiLanguage) => {
      setUser((u) => (u ? { ...u, language: lang } : u)) // optimistic
      try {
        const updated = await authApi.updateMe({ language: lang })
        setUser(updated)
      } catch {
        /* keep the optimistic value; next refresh reconciles */
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* clearing cookies server-side is best-effort */
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isEnterprise: !!user,
        isPlatformAdmin: !!user && (!!user.is_platform_admin || !!user.is_superuser),
        language: user?.language === 'ur' ? 'ur' : 'en',
        setLanguage,
        enterpriseLogin,
        enterpriseRegister,
        completeMfa,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be within <AuthProvider>')
  return ctx
}
