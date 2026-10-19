"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  Menu,
  UserRound,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CommandMenu } from "@/components/layout/command-menu";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ROLE_LABELS, type Role } from "@/features/auth/roles";
import { dashboardForRole } from "@/features/auth/dashboard-for-role";
import { displayName } from "@/features/auth/types";
import { useSession } from "@/features/auth/session-context";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  heading: string;
  items: NavItem[];
}

interface AppShellProps {
  nav: NavGroup[];
  portalLabel: string;
  role: Role;
  children: ReactNode;
  /** Extra content for the top bar's right side (e.g. agency selector). */
  topbarExtra?: ReactNode;
}

/**
 * Shared authenticated shell: responsive sidebar navigation (desktop),
 * drawer navigation (mobile), role indicator, command menu (⌘K),
 * breadcrumbs, user menu, and skip link.
 */
export function AppShell({ nav, portalLabel, role, children, topbarExtra }: AppShellProps) {
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

  const name = displayName(user) || "User";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "U";

  const navLinks = (isSidebar: boolean, onNavigate?: () => void) => (
    <nav aria-label={`${portalLabel} navigation`} className="space-y-6">
      {nav.map((group) => (
        <div key={group.heading} className="space-y-1">
          {(!collapsed || !isSidebar) && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.heading}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(item.href);
              const linkContent = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 outline-offset-2",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    collapsed && isSidebar && "justify-center px-2"
                  )}
                >
                  {item.icon && (
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                        active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}
                      aria-hidden="true"
                    />
                  )}
                  {(!collapsed || !isSidebar) && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              );

              if (collapsed && isSidebar) {
                return (
                  <li key={item.href}>
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right" className="font-medium">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                );
              }

              return <li key={item.href}>{linkContent}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden border-r border-border/80 bg-card/60 backdrop-blur-xl lg:flex lg:flex-col transition-all duration-300 ease-in-out z-30 shrink-0",
          collapsed ? "w-20" : "w-64"
        )}
        aria-label="Sidebar"
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-border/70 px-4">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-2.5 transition-opacity hover:opacity-90 overflow-hidden",
              collapsed && "justify-center w-full"
            )}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <span className="font-heading font-bold text-sm tracking-tight text-foreground block">
                  Certification
                </span>
                <span className="text-[11px] font-medium text-muted-foreground block truncate">
                  {portalLabel}
                </span>
              </div>
            )}
          </Link>

          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="h-7 w-7 text-muted-foreground hover:text-foreground ml-auto hidden xl:flex"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          )}
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {navLinks(true)}
        </div>

        {/* Sidebar Footer User & Controls */}
        <div className="border-t border-border/70 p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(false)}
                className="h-8 w-8 text-muted-foreground"
                title="Expand sidebar"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-secondary/50 p-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{name}</p>
                  <p className="truncate text-[11px] text-muted-foreground capitalize">
                    {ROLE_LABELS[role]}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={async () => {
                  await signOut();
                  window.location.assign("/login");
                }}
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">{mobileOpen ? "Close navigation menu" : "Open navigation menu"}</span>
          </Button>

          {/* Quick command search trigger */}
          <div className="flex-1 max-w-sm sm:max-w-md">
            <CommandMenu role={role} />
          </div>

          {/* Role badge */}
          <div className="hidden min-w-0 items-center gap-2 md:flex ml-2">
            <span className="rounded-full bg-secondary/90 border border-border px-2.5 py-1 text-xs font-medium text-secondary-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {ROLE_LABELS[role]}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2.5">
            {topbarExtra}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 px-2 hover:bg-secondary/80 rounded-full h-9"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-xs font-medium sm:inline">
                    {name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 shadow-lg">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={role === "learner" ? "/learner/profile" : dashboardForRole([role])}>
                    <UserRound className="mr-2 h-4 w-4" />
                    {role === "learner" ? "Learner Profile" : "Portal Home"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/catalogue">
                    <Sparkles className="mr-2 h-4 w-4 text-primary" />
                    Course Catalogue
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  onSelect={async () => {
                    await signOut();
                    window.location.assign("/login");
                  }}
                >
                  <LogOut aria-hidden="true" className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              id="mobile-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-border/80 bg-card p-4 lg:hidden shadow-lg overflow-hidden"
            >
              <div className="pb-3 border-b border-border/60 mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[role]}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await signOut();
                    window.location.assign("/login");
                  }}
                  className="text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" /> Sign out
                </Button>
              </div>
              {navLinks(false, () => setMobileOpen(false))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main page content area */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto"
        >
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}
