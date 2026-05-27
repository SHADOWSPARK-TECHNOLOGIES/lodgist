"use client";

import { Shield, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface RiskLabelProps {
  /** Risk level determines icon and colour */
  level: RiskLevel;
  /** Optional custom label */
  label?: string;
  /** Show a short description below the label */
  showDescription?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Additional classes */
  className?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  RiskLevel,
  {
    icon: typeof Shield;
    label: string;
    description: string;
    dotColor: string;
    borderColor: string;
    bgColor: string;
    textColor: string;
  }
> = {
  low: {
    icon: CheckCircle,
    label: "Low Risk",
    description: "Listing passed all trust checks. Verified landlord with good history.",
    dotColor: "bg-[#1ABC9C]",
    borderColor: "border-[#1ABC9C]/20",
    bgColor: "bg-[#1ABC9C]/5",
    textColor: "text-[#1ABC9C]",
  },
  medium: {
    icon: HelpCircle,
    label: "Medium Risk",
    description: "Some checks are incomplete or inconclusive. Review before paying.",
    dotColor: "bg-amber-500",
    borderColor: "border-amber-200",
    bgColor: "bg-amber-50",
    textColor: "text-amber-600",
  },
  high: {
    icon: AlertTriangle,
    label: "High Risk",
    description: "Major red flags detected. Do not pay without thorough verification.",
    dotColor: "bg-red-500",
    borderColor: "border-red-200",
    bgColor: "bg-red-50",
    textColor: "text-red-600",
  },
  unknown: {
    icon: Shield,
    label: "Unverified",
    description: "This listing has not been through our verification process yet.",
    dotColor: "bg-gray-400",
    borderColor: "border-gray-200",
    bgColor: "bg-gray-50",
    textColor: "text-gray-500",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RiskLabel({
  level,
  label,
  showDescription = false,
  size = "md",
  className,
}: RiskLabelProps) {
  const cfg = RISK_CONFIG[level];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "rounded-lg border",
        cfg.bgColor,
        cfg.borderColor,
        showDescription ? "p-4" : "inline-flex items-center gap-2 px-3 py-1.5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {/* Dot indicator */}
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
            cfg.bgColor,
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", cfg.textColor)} />
        </span>

        <div className="space-y-0.5">
          <span
            className={cn(
              "font-semibold",
              size === "sm" ? "text-xs" : "text-sm",
              cfg.textColor,
            )}
          >
            {label ?? cfg.label}
          </span>
          {showDescription && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {cfg.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Derive risk level from truth index ───────────────────────────────────────

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "low";
  if (score >= 50) return "medium";
  if (score > 0) return "high";
  return "unknown";
}
