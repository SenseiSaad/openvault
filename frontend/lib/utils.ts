import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Human-friendly title: drop the stored file extension for display.
export function titleFromName(name: string) {
  return name.replace(/\.(md|markdown|txt|pdf|docx?|csv|rtf|pptx?|xlsx?)$/i, '')
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}
