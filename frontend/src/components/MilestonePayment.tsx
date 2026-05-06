"use client";

import { useState } from "react";
import {
  Wallet,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Milestone {
  id: string;
  label: string;
  amount: number;
  currency: string;
  due_date: string;
  status: "pending" | "completed" | "overdue";
  completed_at?: string;
}

interface MilestonePaymentProps {
  milestones: Milestone[];
  onPay?: (milestoneId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MilestonePayment({
  milestones,
  onPay,
}: MilestonePaymentProps) {
  const [expanded, setExpanded] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const totalPaid = milestones
    .filter((m) => m.status === "completed")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalPending = milestones
    .filter((m) => m.status === "pending")
    .reduce((sum, m) => sum + m.amount, 0);

  const currency = milestones[0]?.currency ?? "NGN";

  const handlePay = async (id: string) => {
    if (!onPay) return;
    setPayingId(id);
    try {
      await onPay(id);
    } finally {
      setPayingId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-teal" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-400" />;
    }
  };

  if (milestones.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <Wallet className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">No milestone payments configured</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/15">
            <Wallet className="h-5 w-5 text-teal" />
          </div>
          <div className="text-left">
            <h3 className="font-heading text-base font-semibold text-off-white">
              Milestone Payments
            </h3>
            <p className="text-xs text-light-gray">
              {milestones.length} milestone{milestones.length > 1 ? "s" : ""} ·{" "}
              {totalPaid > 0
                ? `${currency} ${totalPaid.toLocaleString()} paid`
                : "No payments yet"}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-light-gray" />
        ) : (
          <ChevronDown className="h-4 w-4 text-light-gray" />
        )}
      </button>

      {/* Summary Bar */}
      {totalPending > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
          <Clock className="h-3 w-3" />
          <span>
            {currency} {totalPending.toLocaleString()} pending across{" "}
            {milestones.filter((m) => m.status === "pending").length} milestone
            {milestones.filter((m) => m.status === "pending").length > 1
              ? "s"
              : ""}
          </span>
        </div>
      )}

      {/* Expanded List */}
      {expanded && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border p-3 transition-all ${
                m.status === "completed"
                  ? "border-teal/20 bg-teal/5"
                  : m.status === "overdue"
                    ? "border-red-400/20 bg-red-400/5"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {statusIcon(m.status)}
                  <div>
                    <p className="text-sm font-medium text-off-white">
                      {m.label}
                    </p>
                    <p className="text-xs text-light-gray">
                      Due: {new Date(m.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-off-white">
                    {currency} {m.amount.toLocaleString()}
                  </p>
                  {m.status === "pending" && onPay && (
                    <button
                      onClick={() => handlePay(m.id)}
                      disabled={payingId === m.id}
                      className="mt-1 rounded bg-teal px-3 py-1 text-xs font-medium text-white transition-all hover:bg-teal/80 disabled:opacity-50"
                    >
                      {payingId === m.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Pay Now"
                      )}
                    </button>
                  )}
                  {m.status === "completed" && m.completed_at && (
                    <p className="mt-1 text-[10px] text-teal">
                      Paid {new Date(m.completed_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
