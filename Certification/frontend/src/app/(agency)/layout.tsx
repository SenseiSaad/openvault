"use client";

import { Home, Users, MailCheck, Armchair, BookOpen, ReceiptText, CreditCard } from "lucide-react";
import { RequireAuth } from "@/features/auth/guards";
import { useActiveRole } from "@/features/auth/agency-context";
import { AgencySelector } from "@/features/auth/agency-selector";
import { AppShell, type NavGroup } from "@/components/common/app-shell";
import { PublicIdBlocker } from "@/components/common/integration-boundaries";
import { useAgency } from "@/features/auth/agency-context";

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ href: "/agency", label: "Agency overview", icon: Home }]
  },
  {
    heading: "People",
    items: [
      { href: "/agency/members", label: "Members", icon: Users },
      { href: "/agency/invitations", label: "Invitations", icon: MailCheck },
      { href: "/agency/seats", label: "Seats & entitlements", icon: Armchair }
    ]
  },
  {
    heading: "Procurement",
    items: [
      { href: "/agency/catalogue", label: "Training catalogue", icon: BookOpen },
      { href: "/agency/orders", label: "Orders", icon: ReceiptText },
      { href: "/agency/billing", label: "Billing", icon: CreditCard }
    ]
  }
];

export default function AgencyLayout({ children }: { children: React.ReactNode }) {
  const role = useActiveRole();
  const { missingPublicId, activeAgency } = useAgency();

  return (
    <RequireAuth roles={["agency_admin", "super_admin"]}>
      <AppShell
        nav={NAV}
        portalLabel="Agency Administration"
        role={role ?? "agency_admin"}
        topbarExtra={<AgencySelector />}
      >
        {missingPublicId ? (
          <PublicIdBlocker />
        ) : (
          <p className="sr-only">Active agency: {activeAgency?.name ?? "none"}</p>
        )}
        {!missingPublicId && children}
      </AppShell>
    </RequireAuth>
  );
}
