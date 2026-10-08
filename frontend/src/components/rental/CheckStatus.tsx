"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ApiError, rentalChecksApi } from "@/lib/api";
import type { RentalCheckStatusView, RentalReport } from "@/lib/types";
import { formatNaira, lockedRecommendation } from "@/lib/rentalCheck";

export default function CheckStatus() {
  const params = useParams<{ reference: string }>();
  const search = useSearchParams();
  const reference = params.reference;
  const token = search.get("token") || "";
  const [status, setStatus] = useState<RentalCheckStatusView | null>(null);
  const [report, setReport] = useState<RentalReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const current = await rentalChecksApi.status(reference);
        if (cancelled) return;
        setStatus(current.data);
        if (token && current.data.reportReady) {
          const ready = await rentalChecksApi.report(reference, token);
          if (!cancelled) setReport(ready.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "We could not load this case.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reference, token]);

  const headline = report ? lockedRecommendation(report.recommendation) : null;

  return (
    <section className="container py-10">
      <div className="max-w-2xl mx-auto space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-orange)" }}>
          Rental Safety Check
        </p>
        <h1 className="font-poppins text-3xl font-bold text-white">Case {reference}</h1>
        {error && <p role="alert" className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
        {!status && !error && <p className="text-sm text-white">Loading case</p>}
        {status && (
          <div className="card space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
            <p>Status: {status.status}</p>
            <p>Payment: {status.paymentStatus}</p>
            <p>Review: {status.reviewStatus}</p>
            <p>Fee: {formatNaira(status.amountNgn)}. This is the check fee, not rent and not a deposit.</p>
            <p>Online checkout is not open. This page cannot mark the fee paid.</p>
            {status.paymentStatus === "PAID" ? (
              <p>Staff confirmed the fee. That does not verify the home.</p>
            ) : status.paymentReferenceSubmitted ? (
              <p>A reference is on file. Staff have not confirmed the money.</p>
            ) : (
              <p>No transfer reference is on file.</p>
            )}
            <p>Payment of the fee does not verify the home.</p>
          </div>
        )}
        {report && (
          <article className="card space-y-4">
            <h2 className="font-poppins text-xl font-bold text-white">{headline || "Report ready"}</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{report.disclaimer}</p>
            <p className="text-white">Trust score: {report.trustScore == null ? "Not scored" : report.trustScore}</p>
            <p className="text-white">Confidence: {report.confidence || "Not set"}</p>
            <p className="text-sm text-white">Location: {report.location}</p>
            <p className="text-sm text-white">Asking rent: {formatNaira(report.askingRent)}</p>
            <div>
              <h3 className="font-poppins font-semibold text-white mb-2">What was checked</h3>
              {report.checked.length === 0 ? (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>Nothing was marked checked.</p>
              ) : (
                <ul className="text-sm space-y-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {report.checked.map((item) => <li key={item}>{item}: Checked. Checked is not the same as verified.</li>)}
                </ul>
              )}
            </div>
            <div>
              <h3 className="font-poppins font-semibold text-white mb-2">What could not be verified</h3>
              <ul className="text-sm space-y-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                {report.couldNotVerify.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            {report.sections.map((section) => (
              <section key={section.key}>
                <h3 className="font-poppins font-semibold text-white">{section.label}</h3>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{section.stateLabel}</p>
                {section.note && <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>{section.note}</p>}
                {section.provenance && <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{section.provenance}</p>}
              </section>
            ))}
            <div>
              <h3 className="font-poppins font-semibold text-white mb-2">Recommended next actions</h3>
              <ul className="text-sm space-y-1" style={{ color: "rgba(255,255,255,0.75)" }}>
                {report.nextActions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </article>
        )}
        {status && !status.reportReady && (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            The report appears here after a reviewer publishes it. You can keep this link to check status.
          </p>
        )}
      </div>
    </section>
  );
}
