import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Certification Academy home">
            <GraduationCap aria-hidden="true" className="h-6 w-6 text-primary" />
            Certification Academy
          </Link>
          <nav aria-label="Primary" className="text-sm">
            <Link className="underline-offset-4 hover:underline" href="/catalogue">
              Training catalogue
            </Link>
          </nav>
        </div>
      </header>
      <main id="main-content" className="flex flex-1 flex-col">
        {children}
      </main>
      <footer className="border-t bg-card py-4 text-center text-xs text-muted-foreground">
        <nav aria-label="Footer" className="flex justify-center gap-4">
          <Link className="hover:underline" href="/privacy">Privacy</Link>
          <Link className="hover:underline" href="/terms">Terms</Link>
          <Link className="hover:underline" href="/accessibility">Accessibility</Link>
        </nav>
      </footer>
    </div>
  );
}
