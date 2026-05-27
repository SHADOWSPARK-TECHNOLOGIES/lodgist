"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { RiskStateBadge, type RiskState } from "./RiskStateBadge";
import { TruthIndexMeter } from "./TruthIndexMeter";

export interface TrustComponent {
  label: string;
  passed: boolean;
  weight: number;
  notes?: string | null;
}

interface TrustPanelProps {
  riskState: RiskState;
  truthIndex: number;
  components: TrustComponent[];
  verificationStatus?: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" | null;
  onRequestVerification?: () => void;
  className?: string;
}

function CheckIcon({ passed }: { passed: boolean }) {
  if (passed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1ABC9C]/10">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
          <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#1ABC9C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100">
      <span className="text-xs font-bold text-gray-400">–</span>
    </span>
  );
}

function ComponentRow({ item }: { item: TrustComponent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5">
        <CheckIcon passed={item.passed} />
        <span className={cn("flex-1 text-sm", item.passed ? "text-gray-700" : "text-gray-400")}>
          {item.label}
        </span>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{item.weight} pts</span>
        {item.notes && (
          <button
            onClick={() => setOpen(!open)}
            className="text-xs text-[#1ABC9C] hover:underline ml-1"
            aria-label="Toggle notes"
          >
            {open ? "less" : "more"}
          </button>
        )}
      </div>
      {open && item.notes && (
        <p className="ml-7 text-xs text-gray-500 leading-relaxed">{item.notes}</p>
      )}
    </div>
  );
}

export function TrustPanel({
  riskState,
  truthIndex,
  components,
  verificationStatus,
  onRequestVerification,
  className,
}: TrustPanelProps) {
  const showRequestButton =
    riskState === "UNVERIFIED" && !verificationStatus;
  const showInProgress =
    verificationStatus === "PENDING" || verificationStatus === "IN_REVIEW";
  const showRejected = verificationStatus === "REJECTED";

  return (
    <div className={cn("rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-4", className)}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0B1B2B]">Trust & Verification</h3>
        <RiskStateBadge state={riskState} />
      </div>

      {/* Meter */}
      <TruthIndexMeter score={truthIndex} size="md" />

      <div className="border-t pt-3 space-y-2.5">
        <p className="text-sm font-semibold text-gray-700">Verification Checklist</p>
        {components.map((item) => (
          <ComponentRow key={item.label} item={item} />
        ))}
      </div>

      {/* Conditional CTA section */}
      {showRequestButton && (
        <div className="border-t pt-3 space-y-1">
          <button
            onClick={onRequestVerification}
            className="w-full rounded-lg bg-[#FF6F3C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85d2c]"
          >
            Request Verification for This Property
          </button>
          <p className="text-center text-xs text-gray-400">
            Free for landlords · Takes 2–5 days
          </p>
        </div>
      )}

      {showInProgress && (
        <div className="rounded-lg bg-[#1ABC9C]/10 border border-[#1ABC9C]/20 p-3 text-xs text-[#0F9D7E]">
          Verification in progress — we will update this listing when complete.
        </div>
      )}

      {showRejected && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Verification was not approved. The landlord may resubmit with additional documents.
        </div>
      )}
    </div>
  );
}

export default TrustPanel;
