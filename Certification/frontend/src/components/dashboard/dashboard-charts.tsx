"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const mockTrendData = [
  { month: "Jan", seats: 32, active: 28 },
  { month: "Feb", seats: 45, active: 40 },
  { month: "Mar", seats: 60, active: 52 },
  { month: "Apr", seats: 78, active: 68 },
  { month: "May", seats: 95, active: 84 },
  { month: "Jun", seats: 112, active: 98 },
  { month: "Jul", seats: 130, active: 115 },
  { month: "Aug", seats: 142, active: 126 }
];

export function SeatUtilizationChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Seat Utilization</CardTitle>
          <CardDescription>Agency enrollment trajectory (last 8 months)</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-xs text-muted-foreground">
          Loading chart data...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Seat Utilization & Growth</CardTitle>
          <CardDescription>Agency enrollment trajectory (last 8 months)</CardDescription>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-muted-foreground">Total Seats</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Active Learners</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSeats" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E2E8F0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "12px"
                }}
              />
              <Area type="monotone" dataKey="seats" stroke="#4F46E5" strokeWidth={2} fillOpacity={1} fill="url(#colorSeats)" />
              <Area type="monotone" dataKey="active" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorActive)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const mockCompletionData = [
  { name: "Cybersecurity", completed: 85, inProgress: 15 },
  { name: "Privacy", completed: 72, inProgress: 28 },
  { name: "Ethics", completed: 94, inProgress: 6 },
  { name: "Cloud Sec", completed: 64, inProgress: 36 },
  { name: "Incident Resp", completed: 50, inProgress: 50 }
];

export function ComplianceRateChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card className="border-border/80 shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Course Completion Rate</CardTitle>
          <CardDescription>Mandatory certification benchmarks</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-xs text-muted-foreground">
          Loading chart data...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 shadow-card">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Course Completion Rates</CardTitle>
          <CardDescription>Mandatory certification progress %</CardDescription>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>Completion %</span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockCompletionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.6} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#64748B" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748B" }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E2E8F0",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: "12px"
                }}
              />
              <Bar dataKey="completed" fill="#4F46E5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
