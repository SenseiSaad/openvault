"use client";

import { LayoutDashboard, Building2, BookOpen, Tags, KeyRound, ScrollText } from "lucide-react";
import { RequireAuth } from "@/features/auth/guards";
import { useActiveRole } from "@/features/auth/agency-context";
import { AppShell, type NavGroup } from "@/components/common/app-shell";

const NAV: NavGroup[] = [
  {
    heading: "Platform",
    items: [
      { href: "/platform", label: "Overview", icon: LayoutDashboard },
      { href: "/platform/agencies", label: "Agencies", icon: Building2 }
    ]
  },
  {
    heading: "Catalog",
    items: [
      { href: "/platform/catalog", label: "Courses & versions", icon: BookOpen },
      { href: "/platform/products", label: "Products & pricing", icon: Tags }
    ]
  },
  {
    heading: "Controls",
    items: [
      { href: "/platform/entitlements", label: "Entitlements", icon: KeyRound },
      { href: "/platform/audit", label: "Audit & operations", icon: ScrollText }
    ]
  }
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  // training_manager is routed here after login (dashboardForRole), so the
  // portal accepts both platform-side roles; the backend stays authoritative.
  const role = useActiveRole();
  return (
    <RequireAuth roles={["super_admin", "training_manager"]}>
      <AppShell nav={NAV} portalLabel="Platform Administration" role={role ?? "super_admin"}>
        {children}
      </AppShell>
    </RequireAuth>
  );
}
