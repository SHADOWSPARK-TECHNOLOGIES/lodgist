"use client";

import { useState } from "react";
import {
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

interface Payment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  created_at: string;
  completed_at?: string;
  method?: string;
}

interface PaymentStatusCardProps {
  payments: Payment[];
  onRetry?: (paymentId: string) => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const statusConfig: Record<
  PaymentStatus,
  { icon: typeof CheckCircle; color: string; label: string }
> = {
  completed: {
    icon: CheckCircle,
    color: "text-teal",
    label: "Completed",
  },
  pending: {
    icon: Clock,
    color: "text-yellow-400",
    label: "Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-red-400",
    label: "Failed",
  },
  refunded: {
    icon: AlertTriangle,
    color: "text-blue-400",
    label: "Refunded",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PaymentStatusCard({
  payments,
  onRetry,
}: PaymentStatusCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const totalCompleted = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.amount, 0);

  const currency = payments[0]?.currency ?? "NGN";

  const handleRetry = async (id: string) => {
    if (!onRetry) return;
    setRetryingId(id);
    try {
      await onRetry(id);
    } finally {
      setRetryingId(null);
    }
  };

  if (payments.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <CreditCard className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">No payment records</span>
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
            <CreditCard className="h-5 w-5 text-teal" />
          </div>
          <div className="text-left">
            <h3 className="font-heading text-base font-semibold text-off-white">
              Payment Status
            </h3>
            <p className="text-xs text-light-gray">
              {payments.length} transaction{payments.length > 1 ? "s" : ""} ·{" "}
              {currency} {totalCompleted.toLocaleString()} completed
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-light-gray" />
        ) : (
          <ChevronDown className="h-4 w-4 text-light-gray" />
        )}
      </button>

      {/* Summary */}
      {totalPending > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-400/10 px-3 py-2 text-xs text-yellow-400">
          <Clock className="h-3 w-3" />
          <span>
            {currency} {totalPending.toLocaleString()} pending
          </span>
        </div>
      )}

      {/* Expanded List */}
      {expanded && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {payments.map((p) => {
            const cfg = statusConfig[p.status];
            const Icon = cfg.icon;
            return (
              <div
                key={p.id}
                className="rounded-lg border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <Icon className={`mt-0.5 h-4 w-4 ${cfg.color}`} />
                    <div>
                      <p className="text-sm font-medium text-off-white">
                        {p.description}
                      </p>
                      <p className="text-[10px] text-light-gray">
                        Ref: {p.reference}
                      </p>
                      <p className="text-[10px] text-light-gray">
                        {new Date(p.created_at).toLocaleDateString()}
                        {p.method && ` · ${p.method}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-off-white">
                      {p.currency} {p.amount.toLocaleString()}
                    </p>
                    <span
                      className={`text-[10px] font-medium uppercase ${cfg.color}`}
                    >
                      {cfg.label}
                    </span>
                    {p.status === "failed" && onRetry && (
                      <button
                        onClick={() => handleRetry(p.id)}
                        disabled={retryingId === p.id}
                        className="ml-2 rounded bg-teal px-2 py-0.5 text-[10px] font-medium text-white transition-all hover:bg-teal/80 disabled:opacity-50"
                      >
                        {retryingId === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Retry"
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
