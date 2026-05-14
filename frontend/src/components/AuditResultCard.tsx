"use client";

import { apiUrl } from "@/lib/api";
import { ShieldCheck, AlertTriangle, Info, Loader2 } from "lucide-react";
import { useState } from "react";

interface AuditResult {
  risk_level: string;
  overall_score: number;
  components: Record<string, number>;
  recommendations: string[];
  requires_review: boolean;
}

interface AuditResultCardProps {
  listingId: string | number;
}

export default function AuditResultCard({ listingId }: AuditResultCardProps) {
  const [result, setResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/ai-analysis/assess-risk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: {
            ai_analysis: { score: 0, flags: [] },
            land_registry: { document_found: false, plot_valid: false },
            geospatial: { lat: 6.45, lng: 7.51 },
            owner_verification: { verified: false, history_length: 0 },
          },
        }),
      });
      if (!res.ok) throw new Error("Audit request failed");
      const data = await res.json();
      setResult(data.assessment ?? data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const levelColor = (level: string) => {
    switch (level) {
      case "low":
        return "text-teal border-teal/30 bg-teal/10";
      case "medium":
        return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
      case "high":
        return "text-orange-400 border-orange-400/30 bg-orange-400/10";
      case "critical":
        return "text-red-400 border-red-400/30 bg-red-400/10";
      default:
        return "text-light-gray border-light-gray/30 bg-light-gray/10";
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-deep-navy/80 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-lg font-semibold text-off-white">
          <ShieldCheck className="h-5 w-5 text-teal" />
          Trust Audit
        </h3>
        <button
          onClick={runAudit}
          disabled={loading}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition-all hover:bg-teal/80 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scanning…
            </span>
          ) : (
            "Run Audit"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-400/10 p-3 text-sm text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Overall Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-light-gray">Risk Level</span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${levelColor(result.risk_level)}`}
            >
              {result.risk_level.toUpperCase()}
            </span>
          </div>

          {/* Score Bar */}
          <div>
            <div className="mb-1 flex justify-between text-xs text-light-gray">
              <span>Overall Score</span>
              <span>{result.overall_score}/100</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-deep-navy/50">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${result.overall_score}%`,
                  backgroundColor:
                    result.overall_score > 60 ? "#1ABC9C" : "#FF6F3C",
                }}
              />
            </div>
          </div>

          {/* Component Scores */}
          {Object.keys(result.components).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-light-gray">
                Component Breakdown
              </p>
              <div className="space-y-1.5">
                {Object.entries(result.components).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-light-gray">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-off-white">{val}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-light-gray">
                <Info className="h-3 w-3" />
                Recommendations
              </p>
              <ul className="space-y-1">
                {result.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-light-gray"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.requires_review && (
            <div className="flex items-center gap-2 rounded-lg bg-orange-400/10 p-3 text-sm text-orange-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This listing requires manual review
            </div>
          )}
        </div>
      )}
    </div>
  );
}
