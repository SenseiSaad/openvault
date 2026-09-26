'use client'

import Link from 'next/link'
import { Download } from 'lucide-react'
import type { DocCard } from '@/lib/api'

// Soft tint per category so the grid stays visually varied.
const TINTS: Record<string, string> = {
  Finance: 'from-[#d9e8ff] to-[#f5f0ff]',
  Legal: 'from-[#e7ddf6] to-[#f6efff]',
  HR: 'from-[#f8dfd2] to-[#fff4e5]',
  Technology: 'from-[#d9eee9] to-[#f2fbf6]',
  Marketing: 'from-[#fce4ec] to-[#fff0f4]',
  Research: 'from-[#e7f0dc] to-[#f9f7ec]',
  Operations: 'from-[#dcecff] to-[#eef6ff]',
  Other: 'from-[#ece9e2] to-[#f7f6f2]',
}

export function tintFor(category: string) {
  return TINTS[category] || TINTS.Other
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
      <div className={`relative flex aspect-[1.3/1] flex-col justify-between overflow-hidden rounded-[22px] bg-gradient-to-br ${tintFor(doc.category)} p-5 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lg`}>
        <span className="w-fit rounded-full bg-white/65 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em]">
          {doc.category}
        </span>
        <span className="font-serif text-3xl leading-tight tracking-[-0.03em] text-[#1d1d1b] line-clamp-3">
          {doc.filename}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[#77746c]">
        {doc.description || doc.preview || 'No description provided.'}
      </p>
      <p className="mt-2 flex items-center gap-2 text-xs text-[#98958c]">
        <span>{doc.company}</span>
        <span>·</span>
        <span>{formatDate(doc.created_at)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1"><Download className="size-3" />{doc.downloads}</span>
      </p>
    </Link>
  )
}
