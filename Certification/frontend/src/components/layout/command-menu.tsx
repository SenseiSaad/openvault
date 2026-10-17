"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MailCheck,
  ReceiptText,
  Search,
  Settings,
  Shield,
  User,
  Users
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import { useSession } from "@/features/auth/session-context";
import { Role } from "@/features/auth/roles";
import { Button } from "@/components/ui/button";

interface CommandMenuProps {
  role?: Role;
}

export function CommandMenu({ role }: CommandMenuProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { signOut } = useSession();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName))) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="relative h-9 w-full justify-start text-xs text-muted-foreground sm:w-60 md:w-72 lg:w-80 rounded-lg border-border/80 bg-background/50 hover:bg-background"
      >
        <Search className="mr-2 h-3.5 w-3.5" />
        <span className="inline-flex">Search or type a command...</span>
        <kbd className="pointer-events-none absolute right-2 top-2 hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {role === "learner" && (
            <CommandGroup heading="Learning">
              <CommandItem onSelect={() => runCommand(() => router.push("/learner"))}>
                <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                <span>Dashboard Overview</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/learner/learning"))}>
                <BookOpen className="mr-2 h-4 w-4 text-primary" />
                <span>My Assigned Courses</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/learner/certificates"))}>
                <GraduationCap className="mr-2 h-4 w-4 text-primary" />
                <span>Certificates & Credentials</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/learner/profile"))}>
                <User className="mr-2 h-4 w-4 text-primary" />
                <span>My Profile</span>
              </CommandItem>
            </CommandGroup>
          )}

          {(role === "agency_admin" || role === "super_admin") && (
            <CommandGroup heading="Agency Administration">
              <CommandItem onSelect={() => runCommand(() => router.push("/agency"))}>
                <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
                <span>Agency Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/agency/members"))}>
                <Users className="mr-2 h-4 w-4 text-primary" />
                <span>Manage Members Directory</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/agency/invitations"))}>
                <MailCheck className="mr-2 h-4 w-4 text-primary" />
                <span>Invitations & Onboarding</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/agency/seats"))}>
                <Building2 className="mr-2 h-4 w-4 text-primary" />
                <span>Seat Allocations</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/agency/catalogue"))}>
                <BookOpen className="mr-2 h-4 w-4 text-primary" />
                <span>Procure Training Catalogue</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/agency/orders"))}>
                <ReceiptText className="mr-2 h-4 w-4 text-primary" />
                <span>Orders & Invoices</span>
              </CommandItem>
            </CommandGroup>
          )}

          {(role === "super_admin" || role === "training_manager") && (
            <CommandGroup heading="Platform Fleet">
              <CommandItem onSelect={() => runCommand(() => router.push("/platform"))}>
                <Shield className="mr-2 h-4 w-4 text-primary" />
                <span>Platform Fleet Overview</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/platform/agencies"))}>
                <Building2 className="mr-2 h-4 w-4 text-primary" />
                <span>Government Agencies</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/platform/catalog"))}>
                <BookOpen className="mr-2 h-4 w-4 text-primary" />
                <span>Master Course Catalog</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/platform/audit"))}>
                <Settings className="mr-2 h-4 w-4 text-primary" />
                <span>Security Audit Log</span>
              </CommandItem>
            </CommandGroup>
          )}

          <CommandSeparator />

          <CommandGroup heading="Account & System">
            <CommandItem
              onSelect={() =>
                runCommand(async () => {
                  await signOut();
                  window.location.assign("/login");
                })
              }
            >
              <LogOut className="mr-2 h-4 w-4 text-destructive" />
              <span className="text-destructive">Sign Out</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
