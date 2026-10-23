import Link from 'next/link'
import { Logo } from './logo'
import { ThemeToggle } from './theme-toggle'

/**
 * Shared chrome for the small account-recovery and verification screens.
 * Keeps the brand and theme switch consistent without repeating layout code.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-8">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10" />
      <div className="w-full max-w-[28rem]">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>

        <div className="rounded-[1.25rem] border border-border bg-surface p-6 shadow-xl shadow-black/[0.03] sm:p-8">
          {children}
        </div>

        <p className="mt-5 text-center text-[10px] text-muted-foreground">
          Private by default. Access is controlled by your organization. ·{' '}
          <Link href="/policy" className="underline-offset-4 hover:text-foreground hover:underline">
            Security model
          </Link>
        </p>
      </div>
    </main>
  )
}

export default AuthShell
