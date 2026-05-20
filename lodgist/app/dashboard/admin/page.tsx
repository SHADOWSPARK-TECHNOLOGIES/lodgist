"use client";

import React, { useEffect, useState } from "react";
import withRole from "@/components/with-role";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  Flag,
  ShieldCheck,
  CalendarCheck,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BookingWithListing {
  id: string;
  listingId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
  listing: {
    id: string;
    price: number;
    property: { address: string; city: string; state: string };
  };
  tenant?: { id: string; name: string | null; email: string };
}

interface AdminStats {
  totalListings: number;
  flaggedListings: number;
  pendingVerifications: number;
  totalBookings: number;
  totalUsers: number;
  listingsPerState: Array<{ state: string; count: number }>;
  recentBookings: BookingWithListing[];
}

// ─── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`rounded-full p-3 ${colorClass}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Simple Bar Chart (inline SVG, no external dependency) ───────────────────

function ListingsPerStateChart({
  data,
}: {
  data: Array<{ state: string; count: number }>;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const barMaxHeight = 160;

  return (
    <div className="flex h-48 items-end gap-2 overflow-x-auto pb-2">
      {data.map((item) => {
        const height = Math.max(4, (item.count / maxCount) * barMaxHeight);
        return (
          <div
            key={item.state}
            className="flex flex-col items-center gap-1"
            title={`${item.state}: ${item.count} listings`}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {item.count}
            </span>
            <div
              className="w-8 rounded-t bg-[#FF6F3C] transition-all hover:bg-[#FF6F3C]/80"
              style={{ height: `${height}px` }}
            />
            <span className="max-w-12 truncate text-[10px] text-muted-foreground">
              {item.state}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        colorMap[status.toLowerCase()] ?? "bg-gray-100 text-gray-800"
      }`}
    >
      {status}
    </span>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          throw new Error(`Failed to fetch stats: ${res.statusText}`);
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#FF6F3C] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <p className="text-lg font-medium text-red-600">Failed to load dashboard</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-[#FF6F3C] px-4 py-2 text-sm font-medium text-white hover:bg-[#FF6F3C]/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#0B1B2B]">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of all listings, users, and platform activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Total Listings"
            value={stats.totalListings}
            icon={Building2}
            colorClass="bg-[#0B1B2B]"
          />
          <StatCard
            title="Flagged Listings"
            value={stats.flaggedListings}
            icon={Flag}
            colorClass="bg-red-500"
          />
          <StatCard
            title="Pending Verifications"
            value={stats.pendingVerifications}
            icon={ShieldCheck}
            colorClass="bg-yellow-500"
          />
          <StatCard
            title="Total Bookings"
            value={stats.totalBookings}
            icon={CalendarCheck}
            colorClass="bg-[#1ABC9C]"
          />
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            colorClass="bg-blue-500"
          />
        </div>

        {/* Chart + Recent Bookings */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Listings per State Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-5 w-5 text-[#FF6F3C]" />
                Listings per State
              </CardTitle>
              <CardDescription>
                Distribution of property listings across Nigerian states
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ListingsPerStateChart data={stats.listingsPerState} />
            </CardContent>
          </Card>

          {/* Recent Bookings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarCheck className="h-5 w-5 text-[#1ABC9C]" />
                Recent Bookings
              </CardTitle>
              <CardDescription>
                Latest booking activity on the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentBookings.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  No recent bookings
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Property</th>
                        <th className="pb-2 pr-4 font-medium">Tenant</th>
                        <th className="pb-2 pr-4 font-medium">Status</th>
                        <th className="pb-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(stats.recentBookings ?? []).slice(0, 8).map((booking) => (
                        <tr key={booking.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">
                            <div className="max-w-40 truncate font-medium">
                              {booking.listing.property.address}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {booking.listing.property.city},{" "}
                              {booking.listing.property.state}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            {booking.tenant?.name ?? "N/A"}
                          </td>
                          <td className="py-2 pr-4">
                            <StatusBadge status={booking.status} />
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {new Date(booking.createdAt).toLocaleDateString("en-NG", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export const dynamic = "force-dynamic";

export default withRole(AdminDashboard, { allowedRoles: ["STUDIO_ADMIN"] });
