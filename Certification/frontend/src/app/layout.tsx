import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Certification Academy — Government Training Platform",
    template: "%s · Certification Academy"
  },
  description:
    "Multi-tenant learning management system for U.S. government agencies: certified training, seat management and compliance reporting.",
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${plusJakartaSans.variable}`}>
      <body className="min-h-screen font-sans bg-background text-foreground antialiased selection:bg-primary/10 selection:text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
