import Link from 'next/link'

// The OpenVault wordmark. Glyph "OV" in the dark chip, two-tone wordmark.
// `size` scales the whole lockup; `href` lets the footer link elsewhere.
export function Logo({
  size = 'md',
  href = '/',
  className = '',
}: {
  size?: 'sm' | 'md'
  href?: string
  className?: string
}) {
  const chip = size === 'sm' ? 'size-7 text-xs rounded-[9px]' : 'size-8 text-sm rounded-[10px]'
  const word = size === 'sm' ? 'text-base' : 'text-lg'
  return (
    <Link
      href={href}
      aria-label="OpenVault home"
      className={`flex items-center gap-2.5 font-semibold tracking-[-0.04em] ${word} ${className}`}
    >
      <span className={`grid place-items-center bg-[#1d1d1b] text-white ${chip}`}>OV</span>
      <span>
        Open<span className="text-[#b1b0ac]">Vault</span>
      </span>
    </Link>
  )
}

export default Logo
