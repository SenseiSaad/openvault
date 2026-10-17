import * as React from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    if (open) window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md animate-[scale-in_0.2s_ease-out] overflow-hidden rounded-[20px] bg-[#f7f6f2] shadow-2xl dark:bg-[#111]">
        <div className="flex items-start justify-between border-b border-[#e6e3dc] bg-[#fffdfa] px-6 py-4 dark:border-[#333] dark:bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className={`grid size-10 place-items-center rounded-xl ${danger ? 'bg-[#fbe4e0] text-[#9a3b2c] dark:bg-red-900/30 dark:text-red-400' : 'bg-[#e6f1e4] text-[#4a7a5a] dark:bg-green-900/30 dark:text-green-400'}`}>
              <AlertTriangle className="size-5" />
            </div>
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <button onClick={onCancel} aria-label="Close" className="rounded-full p-2 text-[#6b6862] hover:bg-[#f2f0ec] hover:text-[#1d1d1b] dark:text-[#999] dark:hover:bg-[#333] dark:hover:text-white">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed text-[#6b6862] dark:text-[#ccc]">{message}</p>
        </div>
        <div className="flex justify-end gap-3 border-t border-[#e6e3dc] bg-[#fffdfa] px-6 py-4 dark:border-[#333] dark:bg-[#1a1a1a]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-[#dcdad3] bg-[#fffdfa] px-4 text-sm font-medium text-[#1d1d1b] hover:bg-[#f2f0ec] focus:outline-none focus:ring-2 focus:ring-[#1d1d1b]/25 disabled:opacity-60 dark:border-[#555] dark:bg-[#222] dark:text-white dark:hover:bg-[#333]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${
              danger
                ? 'bg-[#9a3b2c] hover:bg-[#7a2e22] focus:ring-[#9a3b2c]/50'
                : 'bg-[#1d1d1b] hover:bg-[#3c3b37] focus:ring-[#1d1d1b]/50 dark:bg-white dark:text-black dark:hover:bg-[#eee]'
            }`}
          >
            {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
