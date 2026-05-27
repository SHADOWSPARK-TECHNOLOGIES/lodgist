"use client";

import { BadgeCheck, AlertTriangle, Shield, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerificationState = "verified" | "under_review" | "flagged" | "pending";

export interface TrustBadgeProps {
  /** The verification state determines icon and colour */
  state: VerificationState;
  /** Optional custom label override */
  label?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional classes */
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BADGE_CONFIG: Record<
  VerificationState,
  { icon: typeof Shield; label: string; colors: string }
> = {
  verified: {
    icon: BadgeCheck,
    label: "Verified",
    colors:
      "bg-[#1ABC9C]/10 text-[#1ABC9C] border-[#1ABC9C]/25",
  },
  under_review: {
    icon: Clock,
    label: "Under Review",
    colors:
      "bg-amber-50 text-amber-600 border-amber-200",
  },
  flagged: {
    icon: AlertTriangle,
    label: "Flagged",
    colors:
      "bg-red-50 text-red-600 border-red-200",
  },
  pending: {
    icon: Shield,
    label: "Pending",
    colors:
      "bg-gray-100 text-gray-500 border-gray-200",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function TrustBadge({
  state,
  label,
  size = "md",
  className,
}: TrustBadgeProps) {
  const cfg = BADGE_CONFIG[state];
  const Icon = cfg.icon;

  const sizeClasses = {
    sm: "gap-1 px-2 py-0.5 text-[10px]",
    md: "gap-1.5 px-2.5 py-1 text-xs",
    lg: "gap-2 px-3 py-1.5 text-sm",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold",
        cfg.colors,
        sizeClasses[size],
        className,
      )}
    >
      <Icon className={cn("shrink-0", iconSizes[size])} />
      {label ?? cfg.label}
    </span>
  );
}
