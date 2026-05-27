"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import withRole from "@/components/with-role";
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Clock, ExternalLink,
  FileText, ChevronLeft, Loader2, User, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TruthIndexMeter } from "@/components/trust/TruthIndexMeter";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStatus = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
type ReviewAction = "APPROVE" | "REJECT" | "NEEDS_MORE_INFO" | "IN_REVIEW";

interface TrustComponent {
  componentKey: string;
  label: string;
  weight: number;
  passed: boolean;
}

interface VerificationDetail {
  id: string;
  status: VerificationStatus;
  documentUrls: string[];
  notes: string | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  listing: {
    id: number;
    title: string;
    riskState: string;
    truthIndex: number | null;
    trustComponents: TrustComponent[];
  };
  submittedBy: { id: number; name: string | null; email: string };
  reviewedBy: { id: number; name: string } | null;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<VerificationStatus, { label: string; className: string }> = {
  PENDING:         { label: "Pending",        className: "bg-yellow-100 text-yellow-800" },
  IN_REVIEW:       { label: "In Review",       className: "bg-blue-100 text-blue-800" },
  APPROVED:        { label: "Approved",        className: "bg-[#1ABC9C]/10 text-[#0F9D7E]" },
  REJECTED:        { label: "Rejected",        className: "bg-red-100 text-red-700" },
  NEEDS_MORE_INFO: { label: "Needs More Info", className: "bg-orange-100 text-orange-800" },
};

function StatusBadge({ status }: { status: VerificationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.PENDING;
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", meta.className)}>
      {meta.label}
    </span>
  );
}

// ─── Action Button ────────────────────────────────────────────────────────────

interface ActionBtn {
  action: ReviewAction;
  label: string;
  className: string;
  Icon: React.ElementType;
}

const ACTIONS: ActionBtn[] = [
  { action: "APPROVE",         label: "Approve",         className: "bg-[#1ABC9C] text-white hover:bg-[#15a082]", Icon: CheckCircle2 },
  { action: "NEEDS_MORE_INFO", label: "Needs More Info", className: "bg-orange-500 text-white hover:bg-orange-600", Icon: AlertTriangle },
  { action: "REJECT",          label: "Reject",          className: "bg-red-600 text-white hover:bg-red-700",      Icon: XCircle },
  { action: "IN_REVIEW",       label: "Mark In Review",  className: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50", Icon: Clock },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [detail, setDetail] = useState<VerificationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState<ReviewAction | null>(null);
  const [actionError, setActionError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/verifications/${id}`)
      .then((r) => r.json())
      .then((d) => { setDetail(d); setReviewNote(d.reviewNote ?? ""); })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAction(action: ReviewAction) {
    setSubmitting(action);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/verifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote: reviewNote || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setActionError(data.message ?? "Action failed. Please try again.");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/dashboard/admin/verifications"), 1200);
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#1ABC9C]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Verification request not found.</p>
      </div>
    );
  }

  const isTerminal = detail.status === "APPROVED" || detail.status === "REJECTED";

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* Back link + header */}
        <div className="mb-6">
          <Link
            href="/dashboard/admin/verifications"
            className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-[#0B1B2B] transition"
          >
            <ChevronLeft className="h-4 w-4" /> Verification Queue
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#0B1B2B]">Review Request</h1>
            <StatusBadge status={detail.status} />
          </div>
          <p className="mt-0.5 text-xs text-gray-400">ID: {detail.id}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">

          {/* Left: main info */}
          <div className="space-y-5 lg:col-span-2">

            {/* Listing card */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1B2B]">
                <Building2 className="h-4 w-4 text-[#FF6F3C]" /> Listing
              </div>
              <div>
                <p className="font-medium text-[#0B1B2B]">{detail.listing.title}</p>
                <Link
                  href={`/listings/${detail.listing.id}`}
                  target="_blank"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#1ABC9C] hover:underline"
                >
                  View listing <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              {detail.listing.truthIndex != null && (
                <TruthIndexMeter score={detail.listing.truthIndex} size="sm" />
              )}
            </div>

            {/* Submitter */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1B2B]">
                <User className="h-4 w-4 text-[#FF6F3C]" /> Submitted By
              </div>
              <p className="text-sm font-medium">{detail.submittedBy.name ?? "—"}</p>
              <p className="text-xs text-gray-500">{detail.submittedBy.email}</p>
              <p className="text-xs text-gray-400">
                {new Date(detail.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>

            {/* Documents */}
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1B2B]">
                <FileText className="h-4 w-4 text-[#FF6F3C]" /> Documents ({detail.documentUrls.length})
              </div>
              {detail.documentUrls.length === 0 ? (
                <p className="text-sm text-gray-400">No documents uploaded.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.documentUrls.map((url, i) => {
                    const name = url.split("/").pop() ?? `Document ${i + 1}`;
                    return (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-[#0B1B2B] hover:bg-gray-50 transition"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="flex-1 truncate">{decodeURIComponent(name)}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Landlord notes */}
            {detail.notes && (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-2">
                <p className="text-sm font-semibold text-[#0B1B2B]">Landlord Notes</p>
                <p className="text-sm text-gray-600 leading-relaxed">{detail.notes}</p>
              </div>
            )}

            {/* Trust components */}
            {detail.listing.trustComponents.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm font-semibold text-[#0B1B2B]">Trust Components</p>
                <ul className="space-y-2">
                  {detail.listing.trustComponents.map((c) => (
                    <li key={c.componentKey} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          c.passed ? "bg-[#1ABC9C]" : "bg-gray-300",
                        )} />
                        <span className="text-gray-700">{c.label}</span>
                      </div>
                      <span className="text-gray-400">weight: {c.weight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: review actions */}
          <div className="space-y-5">
            <div className="rounded-xl border bg-white p-5 shadow-sm space-y-4 sticky top-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0B1B2B]">
                <Shield className="h-4 w-4 text-[#1ABC9C]" /> Review Decision
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">Review Note</label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Add a note for the landlord (optional)..."
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  disabled={isTerminal}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C] disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="text-right text-xs text-gray-400">{reviewNote.length}/1000</p>
              </div>

              {done ? (
                <div className="flex items-center gap-2 rounded-lg bg-[#1ABC9C]/10 px-3 py-2.5 text-sm text-[#0F9D7E]">
                  <CheckCircle2 className="h-4 w-4" /> Decision saved — redirecting…
                </div>
              ) : isTerminal ? (
                <div className="rounded-lg bg-gray-50 border px-3 py-2.5 text-xs text-gray-500">
                  This request is already {detail.status.toLowerCase()}.
                  {detail.reviewedBy && (
                    <span> Reviewed by {detail.reviewedBy.name}.</span>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {ACTIONS.map(({ action, label, className, Icon }) => (
                    <button
                      key={action}
                      onClick={() => handleAction(action)}
                      disabled={submitting !== null}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-60",
                        className,
                      )}
                    >
                      {submitting === action ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {actionError && (
                <p className="text-xs text-red-600">{actionError}</p>
              )}

              {detail.reviewedAt && (
                <p className="text-xs text-gray-400">
                  Reviewed {new Date(detail.reviewedAt).toLocaleDateString("en-NG")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
export default withRole(ReviewDetailPage, { allowedRoles: ["STUDIO_ADMIN"] });
