'use client'

import Link from 'next/link'
import { Download } from 'lucide-react'
import type { DocCard } from '@/lib/api'

// Soft tint per genre so the library grid stays visually varied and on-brand.
// Covers the 30 knowledge-library genres plus the legacy business categories.
const TINTS: Record<string, string> = {
  // knowledge-library subject genres
  Technology: 'from-[#d9eee9] to-[#f2fbf6]',
  'Artificial Intelligence': 'from-[#e0e0ff] to-[#f2f0ff]',
  Cybersecurity: 'from-[#d7e3f4] to-[#eef3fb]',
  'Software Engineering': 'from-[#d6f0f5] to-[#eefafb]',
  'Data Science': 'from-[#e6ddf6] to-[#f5f0ff]',
  Biology: 'from-[#d9f0dc] to-[#f0faf0]',
  Biotechnology: 'from-[#d3f0e4] to-[#eefaf3]',
  Medicine: 'from-[#fadadd] to-[#fff0f1]',
  Neuroscience: 'from-[#ecd9f5] to-[#f9f0ff]',
  Genetics: 'from-[#e6f2cc] to-[#f7fbe8]',
  Agriculture: 'from-[#e2eecb] to-[#f5f8e6]',
  'Environmental Science': 'from-[#d6ecd2] to-[#f0f8ee]',
  Climate: 'from-[#d4e9fb] to-[#eef6fe]',
  Energy: 'from-[#fdeccb] to-[#fff8ea]',
  Physics: 'from-[#d8e4fb] to-[#eef2fe]',
  Chemistry: 'from-[#ffe3cc] to-[#fff3e8]',
  Mathematics: 'from-[#dfe1f2] to-[#f1f2fb]',
  Astronomy: 'from-[#d5daf0] to-[#eceefb]',
  Economics: 'from-[#f6e7c4] to-[#fdf6e4]',
  Finance: 'from-[#d9e8ff] to-[#f5f0ff]',
  Business: 'from-[#dde6ee] to-[#f1f5f9]',
  Law: 'from-[#e7ddf6] to-[#f6efff]',
  Education: 'from-[#fbeecf] to-[#fef8e8]',
  Psychology: 'from-[#f0dcee] to-[#fbeff9]',
  Sociology: 'from-[#f6dde6] to-[#fdeef3]',
  History: 'from-[#ecdcc6] to-[#f7efe1]',
  Philosophy: 'from-[#e5e1d6] to-[#f5f2ea]',
  'Arts & Design': 'from-[#fbdce8] to-[#fef0f5]',
  Literature: 'from-[#f0e6d2] to-[#faf4e8]',
  Engineering: 'from-[#dde3ea] to-[#f0f3f6]',
  // legacy business categories (enterprise workspace)
  Legal: 'from-[#e7ddf6] to-[#f6efff]',
  HR: 'from-[#f8dfd2] to-[#fff4e5]',
  Marketing: 'from-[#fce4ec] to-[#fff0f4]',
  Research: 'from-[#e7f0dc] to-[#f9f7ec]',
  Operations: 'from-[#dcecff] to-[#eef6ff]',
  Other: 'from-[#ece9e2] to-[#f7f6f2]',
}

export function tintFor(category: string) {
  return TINTS[category] || TINTS.Other
}

// Human-friendly title: drop the stored file extension for display.
export function titleFromName(name: string) {
  return name.replace(/\.(md|markdown|txt|pdf|docx?|csv|rtf)$/i, '')
}

export function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return ''
  }
}

export default function DocCardView({ doc }: { doc: DocCard }) {
  return (
    <Link href={`/discover/${doc.id}`} className="group block">
      <div className={`relative flex aspect-[1.3/1] flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br ${tintFor(doc.category)} p-4 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg sm:p-5`}>
        <span className="w-fit rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]">
          {doc.category}
        </span>
        <span className="font-serif text-2xl leading-tight tracking-[-0.03em] text-[#1d1d1b] line-clamp-3 sm:text-3xl">
          {titleFromName(doc.filename)}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#77746c]">
        {doc.description || doc.preview || 'No description provided.'}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#98958c]">
        <span>{doc.company}</span>
        <span aria-hidden>·</span>
        <span>{formatDate(doc.created_at)}</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1"><Download className="size-3" />{doc.downloads}</span>
      </p>
    </Link>
  )
}
