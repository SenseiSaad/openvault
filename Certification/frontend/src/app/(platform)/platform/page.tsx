"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  BookOpen,
  Tags,
  Activity,
  ShieldAlert,
  ArrowRight,
  Settings,
  Layers,
  Sparkles
} from "lucide-react";
import { platformApi } from "@/features/platform/api";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SeatUtilizationChart, ComplianceRateChart } from "@/components/dashboard/dashboard-charts";
import { StaggerContainer, StaggerItem } from "@/components/motion/stagger-container";
import { FadeIn } from "@/components/motion/fade-in";

/** Platform overview. Stats endpoint INTEGRATION-UNVERIFIED (IB-5) — missing values render "—". */
export default function PlatformOverviewPage() {
  const stats = useQuery({ queryKey: ["platform", "stats"], queryFn: () => platformApi.stats(), retry: false });

  const platformActions = [
    {
      title: "Agency Directory",
      description: "Manage registered government agency accounts and quotas",
      href: "/platform/agencies",
      icon: Building2
    },
    {
      title: "Catalog Publishing",
      description: "Publish accredited courses, manage versions and modules",
      href: "/platform/catalog",
      icon: BookOpen
    },
    {
      title: "Products & Pricing",
      description: "Configure per-seat entitlement rates and availability",
      href: "/platform/products",
      icon: Tags
    },
    {
      title: "Audit & Compliance Log",
      description: "Inspect immutable security logs and authentication events",
      href: "/platform/audit",
      icon: ShieldAlert
    }
  ];

  return (
    <div className="space-y-6">
      <WelcomeBanner
        title="Fleet Platform Command"
        description="Oversee government agency tenants, master training course versions, and system compliance."
        badge="Platform Operations"
        action={
          <Button asChild className="gap-2 shadow-sm">
            <Link href="/platform/agencies">
              <Building2 className="h-4 w-4" /> Manage Agencies
            </Link>
          </Button>
        }
      />

      {stats.isError ? (
        <EmptyState
          title="Statistics unavailable"
          description="Platform statistics could not be loaded. This is expected until the platform endpoints are connected (IB-5)."
        />
      ) : (
        <StaggerContainer className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              label="Total Agencies"
              value={stats.data?.agencies_total}
              isLoading={stats.isPending}
              href="/platform/agencies"
              icon={Building2}
              variant="indigo"
              trend={{ value: 14, direction: "up" }}
              description="Registered tenant organizations"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Active Tenants"
              value={stats.data?.agencies_active}
              isLoading={stats.isPending}
              href="/platform/agencies"
              icon={Activity}
              variant="emerald"
              trend={{ value: 98, direction: "neutral" }}
              description="Healthy operating state"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Published Courses"
              value={stats.data?.courses_published}
              isLoading={stats.isPending}
              href="/platform/catalog"
              icon={BookOpen}
              variant="sky"
              trend={{ value: 6, direction: "up" }}
              description="Active accredited curricula"
            />
          </StaggerItem>

          <StaggerItem>
            <StatCard
              label="Store Products"
              value={stats.data?.products_total}
              isLoading={stats.isPending}
              href="/platform/products"
              icon={Tags}
              variant="amber"
              trend={{ value: 3, direction: "up" }}
              description="Available for agency checkout"
            />
          </StaggerItem>
        </StaggerContainer>
      )}

      {/* Fleet Telemetry Charts */}
      <FadeIn delay={0.2} className="grid gap-6 lg:grid-cols-2">
        <SeatUtilizationChart />
        <ComplianceRateChart />
      </FadeIn>

      {/* Quick Platform Actions */}
      <FadeIn delay={0.3}>
        <QuickActions title="Platform Fleet Modules" items={platformActions} />
      </FadeIn>
    </div>
  );
}
