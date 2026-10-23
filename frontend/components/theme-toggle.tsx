'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type Theme } from './theme-provider'

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

const TRIGGER_LABEL: Record<Theme, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
}

/**
 * Two presentations of the same control:
 * - `menu`: a compact icon button with a popover, used in the site header.
 * - `segmented`: an inline three-way switch, used in the footer / auth screens.
 */
export function ThemeToggle({
  variant = 'menu',
  compact = false,
}: {
  variant?: 'menu' | 'segmented'
  compact?: boolean
}) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const index = OPTIONS.findIndex((option) => option.value === theme)
    itemRefs.current[Math.max(index, 0)]?.focus()
  }, [open, theme])

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Color theme"
        className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5"
      >
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            title={compact ? label : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
              theme === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5" aria-hidden />
            {compact ? (
              <span className="sr-only">{label}</span>
            ) : (
              <>
                <span className="hidden sm:inline">{label}</span>
                <span className="sr-only sm:hidden">{label}</span>
              </>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Change theme — currently ${TRIGGER_LABEL[theme].toLowerCase()}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
      >
        <Sun className="size-4 dark:hidden" aria-hidden />
        <Moon className="hidden size-4 dark:block" aria-hidden />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Color theme"
          className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-40 overflow-hidden rounded-xl border border-border bg-surface-elevated p-1 shadow-xl shadow-black/10"
        >
          {OPTIONS.map(({ value, label, icon: Icon }, index) => (
            <button
              key={value}
              ref={(node) => { itemRefs.current[index] = node }}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              onClick={() => {
                setTheme(value)
                setOpen(false)
                buttonRef.current?.focus()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
            >
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
              <span className="flex-1">{label}</span>
              {theme === value && <Check className="size-3.5 text-accent" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThemeToggle
