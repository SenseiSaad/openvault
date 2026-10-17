"use client";

import Link from "next/link";
import {
  Users,
  MailCheck,
  Armchair,
  ReceiptText,
  UserPlus,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Activity,
  Layers
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { useAgencyOverview, useAgencyScope } from "@/features/agency/api";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { SeatUtilizationChart, ComplianceRateChart } from "@/components/dashboard/dashboard-charts";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";

export default function AgencyOverviewPage() {
  const { agency } = useAgencyScope();
  const overview = useAgencyOverview();

  const quickActionItems = [
    {
      title: "Invite Member",
      description: "Send invitation link to an agency colleague",
      href: "/agency/invitations",
      icon: UserPlus
    },
    {
      title: "Directory Roster",
      description: "Inspect active staff and assigned roles",
      href: "/agency/members",
      icon: Users
    },
    {
      title: "Procure Training",
      description: "Purchase certified curriculum entitlements",
      href: "/agency/catalogue",
      icon: BookOpen
    },
    {
      title: "Seat Assignments",
      description: "Allocate and release course seat licenses",
      href: "/agency/seats",
      icon: Armchair
    }
  ];

  const recentActivities = [
    {
      id: "act-1",
      title: "Seat Allocation Updated",
      description: "12 new seats assigned to Division Personnel",
      timestamp: "10 mins ago",
      type: "success" as const
    },
    {
      id: "act-2",
      title: "Invitation Accepted",
      description: "sarah.connor@agency.gov activated their account",
      timestamp: "1 hour ago",
      type: "info" as const
    },
    {
      id: "act-3",
      title: "Order Processed",
      description: "Order #ORD-8492 for Cybersecurity 201 confirmed",
      timestamp: "Yesterday",
      type: "info" as const
    }
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title={agency?.name ? `Welcome back, ${agency.name}` : "Agency Operations Command"}
        description="Monitor staff certifications, manage seat allocations, and procure accredited government training."
        agencyName={agency?.name}
        badge="Agency Administration"
        action={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/agency/invitations">
              <UserPlus className="h-4 w-4" /> Invite Staff
            </Link>
          </Button>
        }
      />

      {overview.isError ? (
        <EmptyState
          title="Overview unavailable"
          description="The agency summary could not be loaded. Please verify your connection or try again later."
        />
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              label="Staff Members"
              value={overview.data?.members}
              isLoading={overview.isPending}
              href="/agency/members"
              icon={Users}
              variant="indigo"
              trend={{ value: 12, direction: "up" }}
              description="Active agency accounts"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Pending Invitations"
              value={overview.data?.pending_invitations}
              isLoading={overview.isPending}
              href="/agency/invitations"
              icon={MailCheck}
              variant="amber"
              trend={{ value: 3, direction: "down" }}
              description="Awaiting account activation"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Available Seats"
              value={overview.data?.seats_available}
              isLoading={overview.isPending}
              href="/agency/seats"
              icon={Armchair}
              variant="emerald"
              trend={{ value: 5, direction: "neutral" }}
              description="Unassigned course licenses"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Recent Orders"
              value={overview.data?.recent_orders}
              isLoading={overview.isPending}
              href="/agency/orders"
              icon={ReceiptText}
              variant="sky"
              trend={{ value: 8, direction: "up" }}
              description="Procurement transactions"
            />
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Analytics Visualizations */}
      <FadeIn delay={0.2} className="grid gap-6 lg:grid-cols-2">
        <SeatUtilizationChart />
        <ComplianceRateChart />
      </FadeIn>

      {/* Quick Operations & Activity Feed */}
      <FadeIn delay={0.3} className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuickActions items={quickActionItems} />
        </div>
        <div>
          <ActivityTimeline items={recentActivities} />
        </div>
      </FadeIn>
    </div>
  );
}
