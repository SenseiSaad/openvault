'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeProviderState {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => null,
})

const STORAGE_KEY = 'theme'

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const resolved = theme === 'system' ? systemTheme() : theme

  root.classList.add('theme-transition')
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved

  // Let CSS settle before enabling hover transitions again.
  window.setTimeout(() => root.classList.remove('theme-transition'), 300)
  return resolved
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: Theme
  enableSystem?: boolean
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  // Read the persisted preference on mount. The inline head script has already
  // painted the right class, so this only synchronises React state.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Theme | null
    const next = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : defaultTheme
    setThemeState(next)
    setResolvedTheme(next === 'system' ? systemTheme() : next)
  }, [defaultTheme])

  useEffect(() => {
    const resolved = applyTheme(theme)
    setResolvedTheme(resolved)

    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next = applyTheme('system')
      setResolvedTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  // Follow changes made in another tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      const next = event.newValue as Theme | null
      if (next === 'light' || next === 'dark' || next === 'system') setThemeState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}
