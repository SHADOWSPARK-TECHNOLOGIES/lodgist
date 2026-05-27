"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import withRole from "@/components/with-role";
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowRight, RefreshCw, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";

interface VerificationRow {
  id: string;
  status: VerificationStatus;
  documentUrls: string[];
  notes: string | null;
  createdAt: string;
  listing: { id: number; title: string; riskState: string; truthIndex: number | null };
  submittedBy: { id: number; name: string | null; email: string };
}

interface ApiResponse {
  requests: VerificationRow[];
  total: number;
  page: number;
  pages: number;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<VerificationStatus, { label: string; className: string; Icon: React.ElementType }> = {
  PENDING:         { label: "Pending",          className: "bg-yellow-100 text-yellow-800",   Icon: Clock },
  IN_REVIEW:       { label: "In Review",         className: "bg-blue-100 text-blue-800",       Icon: Shield },
  APPROVED:        { label: "Approved",          className: "bg-[#1ABC9C]/10 text-[#0F9D7E]", Icon: CheckCircle2 },
  REJECTED:        { label: "Rejected",          className: "bg-red-100 text-red-700",         Icon: XCircle },
  NEEDS_MORE_INFO: { label: "Needs More Info",   className: "bg-orange-100 text-orange-800",   Icon: AlertTriangle },
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const { label, className, Icon } = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const TABS: { label: string; value: string }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "In Review", value: "IN_REVIEW" },
  { label: "Needs Info", value: "NEEDS_MORE_INFO" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "All", value: "ALL" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function VerificationsQueuePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("PENDING");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async (status: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/verifications?status=${status}&page=${p}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(activeTab, page); }, [activeTab, page, load]);

  function switchTab(tab: string) {
    setActiveTab(tab);
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard/admin" className="mb-1 flex items-center gap-1 text-sm text-gray-500 hover:text-[#0B1B2B] transition">
              <ChevronLeft className="h-4 w-4" /> Admin Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-[#0B1B2B]">Verification Queue</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Review landlord verification submissions
            </p>
          </div>
          <button
            onClick={() => load(activeTab, page)}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-sm text-gray-600 shadow-sm hover:bg-gray-50 transition"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-white border p-1 shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => switchTab(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition",
                activeTab === tab.value
                  ? "bg-[#0B1B2B] text-white"
                  : "text-gray-600 hover:bg-gray-100",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#FF6F3C] border-t-transparent" />
            </div>
          ) : !data || data.requests.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <Shield className="h-10 w-10 text-gray-200" />
              <p className="text-sm text-gray-500">No {activeTab.toLowerCase()} requests</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
                      <th className="px-4 py-3">Listing</th>
                      <th className="px-4 py-3">Submitted By</th>
                      <th className="px-4 py-3">Docs</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.requests.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-[#0B1B2B] line-clamp-1 max-w-48">{r.listing.title}</div>
                          <div className="text-xs text-gray-400">Listing #{r.listing.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[#0B1B2B]">{r.submittedBy.name ?? "—"}</div>
                          <div className="text-xs text-gray-400">{r.submittedBy.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-gray-500">
                            <FileText className="h-4 w-4" />
                            <span>{r.documentUrls.length}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => router.push(`/dashboard/admin/verifications/${r.id}`)}
                            className="flex items-center gap-1 rounded-lg bg-[#0B1B2B] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a2f47] transition"
                          >
                            Review <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data.pages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-sm text-gray-500">
                    Page {data.page} of {data.pages} · {data.total} total
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded border px-2 py-1 text-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                      disabled={page >= data.pages}
                      className="rounded border px-2 py-1 text-sm disabled:opacity-40"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
export default withRole(VerificationsQueuePage, { allowedRoles: ["STUDIO_ADMIN"] });
