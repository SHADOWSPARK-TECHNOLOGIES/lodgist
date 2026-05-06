"use client";

import { useState } from "react";
import {
  DollarSign,
  Home,
  FileText,
  ShieldCheck,
  Search,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MoveInCostMeta {
  base_rent?: number;
  agency_fee?: number;
  legal_fee?: number;
  caution_fee?: number;
  inspection_fee?: number;
  service_charge?: number;
  total?: number;
  currency?: string;
  payment_structure?: string;
  notes?: string;
}

interface FeeLedgerProps {
  metadata: MoveInCostMeta | null;
  category: "residential" | "commercial" | "short-let";
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                 */
/* ------------------------------------------------------------------ */

type ValidationEntry = {
  label: string;
  key: keyof MoveInCostMeta;
  required: boolean;
};

const RESIDENTIAL_FIELDS: ValidationEntry[] = [
  { label: "Base Rent", key: "base_rent", required: true },
  { label: "Agency Fee", key: "agency_fee", required: true },
  { label: "Legal Fee", key: "legal_fee", required: true },
  { label: "Caution Fee", key: "caution_fee", required: true },
];

const COMMERCIAL_FIELDS: ValidationEntry[] = [
  ...RESIDENTIAL_FIELDS,
  { label: "Inspection Fee", key: "inspection_fee", required: true },
];

function getFields(category: string): ValidationEntry[] {
  switch (category) {
    case "commercial":
      return COMMERCIAL_FIELDS;
    case "short-let":
      return [
        { label: "Base Rent", key: "base_rent", required: true },
        { label: "Service Charge", key: "service_charge", required: false },
        { label: "Caution Fee", key: "caution_fee", required: false },
      ];
    default:
      return RESIDENTIAL_FIELDS;
  }
}

function validateMeta(
  meta: MoveInCostMeta,
  category: string
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fields = getFields(category);

  for (const f of fields) {
    const val = meta[f.key as keyof MoveInCostMeta];
    if (f.required && (typeof val !== "number" || val < 0)) {
      errors.push(`${f.label} is required and must be a non-negative number`);
    }
  }

  // Cross-field total check
  if (typeof meta.total === "number") {
    const sum = fields.reduce((acc, f) => {
      const v = meta[f.key as keyof MoveInCostMeta];
      return acc + (typeof v === "number" ? v : 0);
    }, 0);
    if (Math.abs(sum - meta.total) > 1) {
      warnings.push(
        `Declared total (${meta.currency ?? "NGN"} ${meta.total.toLocaleString()}) ` +
          `differs from sum of components (${meta.currency ?? "NGN"} ${sum.toLocaleString()})`
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FeeLedger({ metadata, category }: FeeLedgerProps) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <DollarSign className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">Move-in cost data not available</span>
        </div>
      </div>
    );
  }

  const { valid, errors, warnings } = validateMeta(metadata, category);
  const fields = getFields(category);
  const currency = metadata.currency ?? "NGN";

  const formatAmount = (val: number | undefined | null) => {
    if (val === undefined || val === null) return "—";
    return `${currency} ${val.toLocaleString()}`;
  };

  return (
    <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/15">
            <DollarSign className="h-5 w-5 text-teal" />
          </div>
          <div className="text-left">
            <h3 className="font-heading text-base font-semibold text-off-white">
              Move-In Cost Ledger
            </h3>
            <p className="text-xs text-light-gray">
              {(category ?? "").charAt(0).toUpperCase() + (category ?? "").slice(1)} ·{" "}
              {metadata.total
                ? `${currency} ${metadata.total.toLocaleString()}`
                : "Total not declared"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {valid && warnings.length === 0 ? (
            <CheckCircle className="h-5 w-5 text-teal" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-light-gray" />
          ) : (
            <ChevronDown className="h-4 w-4 text-light-gray" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
          {/* Field Breakdown */}
          <div className="space-y-2">
            {fields.map((f) => {
              const val = metadata[f.key as keyof MoveInCostMeta];
              const icon =
                f.key === "base_rent"
                  ? Home
                  : f.key === "agency_fee"
                    ? Search
                    : f.key === "legal_fee"
                      ? FileText
                      : f.key === "caution_fee"
                        ? ShieldCheck
                        : DollarSign;
              const Icon = icon;
              return (
                <div
                  key={f.key}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-light-gray" />
                    <span className="text-sm text-light-gray">{f.label}</span>
                    {f.required && (
                      <span className="text-[10px] text-red-400">*</span>
                    )}
                  </div>
                  <span
                    className={`font-mono text-sm ${
                      typeof val !== "number"
                        ? "text-red-400"
                        : "text-off-white"
                    }`}
                  >
                    {formatAmount(typeof val === "number" ? val : undefined)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          {metadata.total !== undefined && metadata.total !== null && (
            <div className="flex items-center justify-between rounded-lg bg-teal/10 px-3 py-2">
              <span className="text-sm font-semibold text-teal">Total</span>
              <span className="font-mono text-base font-bold text-teal">
                {formatAmount(metadata.total)}
              </span>
            </div>
          )}

          {/* Validation Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg bg-red-400/10 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-400">
                <AlertTriangle className="h-3 w-3" />
                Validation Errors
              </p>
              <ul className="space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-300">
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <div className="rounded-lg bg-yellow-400/10 p-3">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-yellow-400">
                <AlertTriangle className="h-3 w-3" />
                Warnings
              </p>
              <ul className="space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-300">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {metadata.notes && (
            <p className="text-xs italic text-light-gray">
              Note: {metadata.notes}
            </p>
          )}

          {/* Payment Structure */}
          {metadata.payment_structure && (
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <span className="text-xs text-light-gray">Payment Structure</span>
              <p className="text-sm text-off-white">
                {metadata.payment_structure}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
