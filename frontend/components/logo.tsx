import Link from 'next/link'

// OpenVault mark: a vault dial reduced to a keyhole. The wordmark stays
// typographic so it reads cleanly at every size and in both themes.
export function Logo({
  size = 'md',
  href = '/',
  className = '',
  tone = 'default',
}: {
  size?: 'sm' | 'md'
  href?: string
  className?: string
  tone?: 'default' | 'inverse'
}) {
  const chip = size === 'sm' ? 'size-7 rounded-[9px]' : 'size-8 rounded-[10px]'
  const word = size === 'sm' ? 'text-[15px]' : 'text-[17px]'
  const chipTone =
    tone === 'inverse'
      ? 'bg-[#f3efe5] text-[#151412]'
      : 'bg-foreground text-background'
  const vaultTone = tone === 'inverse' ? 'text-[#f3efe5]/45' : 'text-muted-foreground'
  const openTone = tone === 'inverse' ? 'text-[#f3efe5]' : ''
  const mark = tone === 'inverse' ? '#9b631e' : 'var(--accent)'

  return (
    <Link
      href={href}
      aria-label="OpenVault home"
      className={`inline-flex items-center gap-2.5 font-display tracking-[-0.045em] ${word} ${className}`}
    >
      <span className={`relative grid shrink-0 place-items-center overflow-hidden ${chipTone} ${chip}`}>
        <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
          <circle cx="16" cy="16" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.45" />
          <path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          <circle cx="16" cy="16" r="2.8" fill={mark} />
          <path d="M16 18.6v3.1" stroke={mark} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className={`leading-none ${openTone}`}>
        Open<span className={vaultTone}>Vault</span>
      </span>
    </Link>
  )
}

export default Logo
