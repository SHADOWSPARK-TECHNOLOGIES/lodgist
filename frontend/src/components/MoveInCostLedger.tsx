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
import { moveIn } from "@/lib/copy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CostItem {
  label: string;
  key: string;
  amount: number;
  icon: "home" | "file" | "shield" | "search" | "dollar";
  required: boolean;
}

interface MoveInCostLedgerProps {
  costs: CostItem[];
  total: number;
  currency?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const iconMap = {
  home: Home,
  file: FileText,
  shield: ShieldCheck,
  search: Search,
  dollar: DollarSign,
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MoveInCostLedger({
  costs,
  total,
  currency = "NGN",
  notes,
}: MoveInCostLedgerProps) {
  const [expanded, setExpanded] = useState(false);

  const computedTotal = costs.reduce((sum, c) => sum + c.amount, 0);
  const totalMatch = Math.abs(computedTotal - total) < 1;

  if (costs.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-deep-navy/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-light-gray">
          <DollarSign className="h-5 w-5 text-vibrant-orange" />
          <span className="text-sm">{moveIn.unavailable}</span>
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
            <DollarSign className="h-5 w-5 text-teal" />
          </div>
          <div className="text-left">
            <h3 className="font-heading text-base font-semibold text-off-white">
              {moveIn.title}
            </h3>
            <p className="text-xs text-light-gray">
              {currency} {total.toLocaleString()} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalMatch ? (
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
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {/* Cost Breakdown */}
          <div className="space-y-2">
            {costs.map((c) => {
              const Icon = iconMap[c.icon] ?? DollarSign;
              return (
                <div
                  key={c.key}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-light-gray" />
                    <span className="text-sm text-light-gray">{c.label}</span>
                    {c.required && (
                      <span className="text-[10px] text-red-400">*</span>
                    )}
                  </div>
                  <span className="font-mono text-sm text-off-white">
                    {currency} {c.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-teal/10 px-3 py-2">
            <span className="text-sm font-semibold text-teal">{moveIn.total}</span>
            <span className="font-mono text-base font-bold text-teal">
              {currency} {total.toLocaleString()}
            </span>
          </div>

          {/* Total Mismatch Warning */}
          {!totalMatch && (
            <div className="flex items-center gap-2 rounded-lg bg-yellow-400/10 p-3 text-xs text-yellow-400">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Declared total ({currency} {total.toLocaleString()}) differs from
              sum of components ({currency} {computedTotal.toLocaleString()})
            </div>
          )}

          {/* Notes */}
          {notes && (
            <p className="text-xs italic text-light-gray">{moveIn.note}: {notes}</p>
          )}
        </div>
      )}
    </div>
  );
}
