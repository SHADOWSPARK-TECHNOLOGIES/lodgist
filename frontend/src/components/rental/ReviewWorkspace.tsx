"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, rentalChecksApi } from "@/lib/api";
import type { EvidenceState, RentalCheckAdmin, RentalCheckMetrics, RentalEvidenceItem } from "@/lib/types";
import { formatNaira, lockedRecommendation } from "@/lib/rentalCheck";

const SECTIONS: { key: string; label: string }[] = [
  { key: "propertyEvidence", label: "Property evidence" },
  { key: "agentIdentity", label: "Agent identity" },
  { key: "phoneConsistency", label: "Phone consistency" },
  { key: "paymentRisk", label: "Payment risk" },
  { key: "askingPrice", label: "Asking-rent context" },
  { key: "neighborhood", label: "Neighborhood" },
  { key: "suspiciousOrMissing", label: "Suspicious or missing evidence" },
];

const STATES: EvidenceState[] = ["not_checked", "checked", "unavailable", "incomplete", "unconfirmed"];

function emptyEvidence(): Record<string, RentalEvidenceItem> {
  const evidence: Record<string, RentalEvidenceItem> = {};
  for (const section of SECTIONS) {
    evidence[section.key] = {
      state: "not_checked",
      note: "",
      provenance: section.key === "neighborhood" ? "unavailable" : "not_checked",
    };
  }
  return evidence;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "Not enough completed cases";
  const hours = Math.round(ms / 36e5);
  if (hours < 48) return `${hours} hours`;
  return `${Math.round(hours / 24)} days`;
}

export default function ReviewWorkspace() {
  const { user, isLoaded } = useAuth();
  const [metrics, setMetrics] = useState<RentalCheckMetrics | null>(null);
  const [cases, setCases] = useState<RentalCheckAdmin[]>([]);
  const [selected, setSelected] = useState<RentalCheckAdmin | null>(null);
  const [score, setScore] = useState("");
  const [confidence, setConfidence] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [notes, setNotes] = useState("");
  const [evidence, setEvidence] = useState(emptyEvidence);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const load = async () => {
    const [metricBody, listBody] = await Promise.all([rentalChecksApi.metrics(), rentalChecksApi.list()]);
    setMetrics(metricBody.data);
    setCases(listBody.data);
  };

  useEffect(() => {
    if (!isLoaded || user?.role !== "STUDIO_ADMIN") return;
    load().catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Could not load cases."));
  }, [isLoaded, user]);

  const openCase = (item: RentalCheckAdmin) => {
    setSelected(item);
    setScore(item.riskScore == null ? "" : String(item.riskScore));
    setConfidence(item.confidence || "");
    setRecommendation(item.recommendation || "");
    setNotes(item.reviewerNotes || "");
    setEvidence({ ...emptyEvidence(), ...(item.evidence || {}) });
    setSaved("");
    setError("");
    setTransferRef("");
    setPaymentNote("");
  };

  const save = async (publish: boolean) => {
    if (!selected) return;
    setError("");
    setSaved("");
    try {
      const result = await rentalChecksApi.review(selected.publicReference, {
        riskScore: score === "" ? undefined : Number(score),
        confidence: confidence || undefined,
        recommendation: recommendation || undefined,
        reviewerNotes: notes,
        evidence,
        publish,
      });
      setSelected(result.data);
      setSaved(publish ? "Report published." : "Review saved.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the review.");
    }
  };

  const recordReference = async () => {
    if (!selected) return;
    setError("");
    setSaved("");
    try {
      const result = await rentalChecksApi.recordPaymentReference(selected.publicReference, transferRef);
      setSelected(result.data);
      setSaved(result.alreadyPaid ? "Fee already confirmed." : "Reference recorded. The fee is not confirmed.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record the reference.");
    }
  };

  const reviewPayment = async (action: "confirm" | "reject") => {
    if (!selected) return;
    setError("");
    setSaved("");
    try {
      const result = await rentalChecksApi.reviewPayment(selected.publicReference, { action, note: paymentNote });
      setSelected(result.data);
      setSaved(result.alreadyPaid ? "Fee already confirmed." : action === "confirm" ? "Fee confirmed." : "Reference rejected.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not review the fee.");
    }
  };

  if (!isLoaded) return <p className="container py-10 text-white">Loading</p>;
  if (!user) {
    return (
      <section className="container py-10">
        <p className="text-white mb-4">Sign in with a reviewer account to open rental checks.</p>
        <Link className="btn btn-primary" href="/login">Sign in</Link>
      </section>
    );
  }
  if (user.role !== "STUDIO_ADMIN") {
    return <p className="container py-10 text-white">This page is for Lodgist reviewers.</p>;
  }

  return (
    <section className="container py-10 space-y-6">
      <h1 className="font-poppins text-3xl font-bold text-white">Rental checks</h1>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
        Missing evidence stays labelled. It is not automatically fraud. Do not publish a claim the evidence does not support.
      </p>
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Submitted", String(metrics.submitted)],
            ["Paid", String(metrics.paid)],
            ["Reports delivered", String(metrics.reportsDelivered)],
            ["Revenue", formatNaira(metrics.revenueNgn)],
            ["Average completion", formatDuration(metrics.averageCompletionMs)],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</p>
              <p className="text-white font-poppins font-semibold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <ul className="card space-y-2">
          {cases.length === 0 && <li className="text-sm text-white">No cases yet.</li>}
          {cases.map((item) => (
            <li key={item.id}>
              <button type="button" className="text-left text-sm text-white w-full" onClick={() => openCase(item)}>
                {item.publicReference} · {item.paymentStatus} · {item.status}
              </button>
            </li>
          ))}
        </ul>
        {selected && (
          <form className="card space-y-3" onSubmit={(event) => event.preventDefault()}>
            <h2 className="font-poppins text-xl text-white">{selected.publicReference}</h2>
            <p className="text-sm text-white">{selected.location} · asking {formatNaira(selected.askingRent)}</p>
            <p className="text-sm text-white">Agent: {selected.agentName || "Not supplied"} · {selected.agentPhone || "No phone"}</p>
            <p className="text-sm text-white">Customer: {selected.customerName || "Name not supplied"} · {selected.customerPhone}</p>
            {selected.listingUrl && <p className="text-sm break-all text-white">{selected.listingUrl}</p>}
            <p className="text-sm text-white">Check fee {formatNaira(selected.amountNgn)}. Payment {selected.paymentStatus}. This is not rent.</p>
            <p className="text-sm text-white">
              Transfer reference: {selected.manualPaymentRef || "None on file"}
            </p>
            {selected.paymentReviewNote && <p className="text-sm text-white">Payment note: {selected.paymentReviewNote}</p>}
            <label className="block text-sm text-white">
              Record a reference the customer already sent. This does not confirm the money.
              <input className="input mt-1" value={transferRef} onChange={(e) => setTransferRef(e.target.value)} />
            </label>
            <label className="block text-sm text-white">
              Receipt note
              <input className="input mt-1" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-secondary" type="button" onClick={recordReference}>Record reference</button>
              <button className="btn btn-primary" type="button" onClick={() => reviewPayment("confirm")}>Confirm receipt</button>
              <button className="btn btn-secondary" type="button" onClick={() => reviewPayment("reject")}>Reject reference</button>
            </div>
            <p className="text-sm text-white">Report review {selected.reviewStatus}.</p>
            {selected.paymentDetails && (
              <p className="text-sm text-white">
                Payment evidence: {selected.paymentDetails.bankName || "Bank not supplied"} · {selected.paymentDetails.accountName || "Account name not supplied"} · {selected.paymentDetails.accountNumber || "Account number not supplied"}
              </p>
            )}
            {selected.customerNotes && <p className="text-sm text-white">Notes: {selected.customerNotes}</p>}
            <label className="block text-sm text-white">
              Trust / risk score (0–100)
              <input className="input mt-1" value={score} onChange={(e) => setScore(e.target.value)} inputMode="numeric" />
            </label>
            <label className="block text-sm text-white">
              Confidence
              <select className="input mt-1" value={confidence} onChange={(e) => setConfidence(e.target.value)}>
                <option value="">Not set</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </label>
            <label className="block text-sm text-white">
              Recommendation
              <select className="input mt-1" value={recommendation} onChange={(e) => setRecommendation(e.target.value)}>
                <option value="">Not set</option>
                <option value="LOWER_RISK">{lockedRecommendation("LOWER_RISK")}</option>
                <option value="UNCERTAIN">{lockedRecommendation("UNCERTAIN")}</option>
                <option value="HIGH_RISK">{lockedRecommendation("HIGH_RISK")}</option>
              </select>
            </label>
            {SECTIONS.map((section) => (
              <fieldset key={section.key} className="space-y-2">
                <legend className="text-sm text-white">{section.label}</legend>
                <select
                  className="input"
                  value={evidence[section.key]?.state || "not_checked"}
                  onChange={(e) =>
                    setEvidence((current) => ({
                      ...current,
                      [section.key]: { ...current[section.key], state: e.target.value as EvidenceState },
                    }))
                  }
                >
                  {STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
                {section.key === "neighborhood" && (
                  <select
                    className="input"
                    value={evidence.neighborhood?.provenance || "unavailable"}
                    onChange={(e) =>
                      setEvidence((current) => ({
                        ...current,
                        neighborhood: { ...current.neighborhood, provenance: e.target.value },
                      }))
                    }
                  >
                    <option value="unavailable">Unavailable — Spatial Lab not used</option>
                    <option value="reviewer_note">Reviewer note, not a measurement</option>
                    <option value="spatial_lab">Attach an existing Spatial Lab result</option>
                  </select>
                )}
                <textarea
                  className="input"
                  rows={2}
                  value={evidence[section.key]?.note || ""}
                  onChange={(e) =>
                    setEvidence((current) => ({
                      ...current,
                      [section.key]: { ...current[section.key], note: e.target.value },
                    }))
                  }
                />
              </fieldset>
            ))}
            <label className="block text-sm text-white">
              Internal notes
              <textarea className="input mt-1" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            {saved && <p className="text-sm text-white">{saved}</p>}
            <div className="flex flex-col sm:flex-row gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => save(false)}>Save review</button>
              <button className="btn btn-primary" type="button" onClick={() => save(true)} style={{ whiteSpace: "normal" }}>Publish report</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
