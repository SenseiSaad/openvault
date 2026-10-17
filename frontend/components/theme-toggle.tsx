'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e6e3dc] bg-[#fffdfa] text-[#1d1d1b] transition-colors hover:bg-[#f2f0ec] focus:outline-none focus:ring-2 focus:ring-[#dcdad3] dark:border-[#333] dark:bg-[#111] dark:text-[#eee] dark:hover:bg-[#222] dark:focus:ring-[#555]"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  )
}
