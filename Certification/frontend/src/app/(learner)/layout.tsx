"use client";

import { Home, BookOpen, Award, ClipboardCheck, UserRound } from "lucide-react";
import { RequireAuth } from "@/features/auth/guards";
import { useActiveRole } from "@/features/auth/agency-context";
import { AgencySelector } from "@/features/auth/agency-selector";
import { AppShell, type NavGroup } from "@/components/common/app-shell";

const NAV: NavGroup[] = [
  {
    heading: "Learning",
    items: [
      { href: "/learner", label: "Dashboard", icon: Home },
      { href: "/learner/learning", label: "My learning", icon: BookOpen },
      { href: "/learner/certificates", label: "Certificates", icon: Award }
    ]
  },
  {
    heading: "Assessments",
    items: [{ href: "/learner/assessments", label: "Assessments", icon: ClipboardCheck }]
  },
  {
    heading: "Account",
    items: [{ href: "/learner/profile", label: "Profile", icon: UserRound }]
  }
];

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  const role = useActiveRole();
  return (
    <RequireAuth>
      <AppShell nav={NAV} portalLabel="Learner Portal" role={role ?? "learner"} topbarExtra={<AgencySelector />}>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
