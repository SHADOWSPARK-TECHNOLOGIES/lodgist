"use client";

import { ShieldCheck, ShieldOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EscrowStatus = "active" | "available" | "unavailable";

export interface EscrowBadgeProps {
  /** Escrow status */
  status: EscrowStatus;
  /** Custom label override */
  label?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional classes */
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ESCOW_CONFIG: Record<
  EscrowStatus,
  { icon: typeof ShieldCheck; label: string; colors: string; iconColors: string }
> = {
  active: {
    icon: ShieldCheck,
    label: "Escrow Active",
    colors:
      "bg-[#1ABC9C]/10 text-[#1ABC9C] border-[#1ABC9C]/25",
    iconColors: "text-[#1ABC9C]",
  },
  available: {
    icon: Lock,
    label: "Escrow Ready",
    colors:
      "bg-blue-50 text-blue-600 border-blue-200",
    iconColors: "text-blue-500",
  },
  unavailable: {
    icon: ShieldOff,
    label: "No Escrow",
    colors:
      "bg-gray-100 text-gray-500 border-gray-200",
    iconColors: "text-gray-400",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EscrowBadge({
  status,
  label,
  size = "md",
  className,
}: EscrowBadgeProps) {
  const cfg = ESCOW_CONFIG[status];
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
      <Icon className={cn("shrink-0", iconSizes[size], cfg.iconColors)} />
      {label ?? cfg.label}
    </span>
  );
}
