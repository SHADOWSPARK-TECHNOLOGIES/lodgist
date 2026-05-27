"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrustPanel, type TrustComponent } from "@/components/trust/TrustPanel";
import { TrustSkeleton } from "@/components/trust/TrustSkeleton";
import type { RiskState } from "@/components/trust/RiskStateBadge";

interface TrustData {
  riskState: RiskState;
  truthIndex: number;
  verificationStatus: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" | null;
  components: TrustComponent[];
}

export function TrustSection({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/listings/${listingId}/trust`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [listingId]);

  if (loading) return <TrustSkeleton />;
  if (!data) return (
    <p className="text-sm text-gray-400">Trust data unavailable for this listing.</p>
  );

  return (
    <TrustPanel
      riskState={data.riskState}
      truthIndex={data.truthIndex}
      components={data.components}
      verificationStatus={data.verificationStatus}
      onRequestVerification={() => router.push(`/verify/${listingId}`)}
    />
  );
}
