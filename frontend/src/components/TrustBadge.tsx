"use client";

import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

interface TrustBadgeProps {
  userId: number;
}

interface TrustData {
  trustScore: number;
  verified: boolean;
  level: "low" | "medium" | "high" | "critical";
}

export default function TrustBadge({ userId }: TrustBadgeProps) {
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`http://localhost:4000/api/verification/${userId}`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          const score = d.trustScore ?? 0;
          setData({
            trustScore: score,
            verified: d.verified ?? false,
            level: score >= 80 ? "high" : score >= 60 ? "medium" : "low",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => ctrl.abort();
  }, [userId]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-deep-navy/50 px-4 py-2 text-sm text-light-gray">
        <Loader2 className="h-4 w-4 animate-spin text-teal" />
        Loading trust score…
      </div>
    );
  }

  if (!data) return null;

  const colorMap = {
    low: "text-red-400 border-red-400/30 bg-red-400/10",
    medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    high: "text-teal border-teal/30 bg-teal/10",
    critical: "text-teal border-teal/30 bg-teal/10",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${colorMap[data.level]}`}
    >
      {data.verified ? (
        <ShieldCheck className="h-4 w-4" />
      ) : (
        <ShieldAlert className="h-4 w-4" />
      )}
      <span>Truth Index: {data.trustScore}</span>
      {data.verified && (
        <span className="ml-1 rounded-full bg-teal/20 px-2 py-0.5 text-xs">
          Verified
        </span>
      )}
    </div>
  );
}
