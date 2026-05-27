"use client";

import { cn } from "@/lib/utils";

export type RiskState = "VERIFIED" | "UNVERIFIED" | "UNDER_REVIEW" | "FLAGGED" | "SUSPENDED";

interface RiskStateBadgeProps {
  state: RiskState;
  className?: string;
}

const CONFIG: Record<RiskState, { label: string; colors: string; icon: React.ReactNode }> = {
  VERIFIED: {
    label: "Verified",
    colors: "bg-[#1ABC9C] text-white",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  UNVERIFIED: {
    label: "Unverified",
    colors: "border border-gray-300 bg-white text-gray-500",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  UNDER_REVIEW: {
    label: "Being Verified",
    colors: "bg-orange-100 text-orange-700",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 3v3.5l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  FLAGGED: {
    label: "Needs Attention",
    colors: "bg-amber-100 text-amber-800",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M6 1.5L10.5 10H1.5L6 1.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 5v2.5M6 9v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  SUSPENDED: {
    label: "Suspended",
    colors: "bg-red-100 text-red-800",
    icon: (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="2" y="5" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
};

export function RiskStateBadge({ state, className }: RiskStateBadgeProps) {
  const cfg = CONFIG[state] ?? CONFIG.UNVERIFIED;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.colors,
        className,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default RiskStateBadge;
