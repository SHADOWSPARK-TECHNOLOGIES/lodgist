"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ApiError, adminListingsApi } from "@/lib/api";
import type { AdminListingReview } from "@/lib/types";
import { formatYearlyRent } from "@/lib/copy";

function placeOf(listing: AdminListingReview): string {
  const property = listing.property;
  if (!property) return "";
  return [property.lga, property.city, property.state].filter(Boolean).join(", ");
}

export default function ListingReviewQueue() {
  const { user, isLoaded } = useAuth();
  const [rows, setRows] = useState<AdminListingReview[]>([]);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reasonErrors, setReasonErrors] = useState<Record<number, string>>({});

  const load = async () => {
    const body = await adminListingsApi.pending();
    setRows(body.data);
  };

  useEffect(() => {
    if (!isLoaded || user?.role !== "STUDIO_ADMIN") return;
    load()
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Could not load listings.");
      })
      .finally(() => setLoaded(true));
  }, [isLoaded, user]);

  // The pressed button can become disabled or disappear after an action, which
  // drops keyboard focus to the page. Move focus to the row heading instead.
  const focusRow = (id: number) => {
    if (typeof document === "undefined") return;
    document.getElementById(`listing-${id}-title`)?.focus();
  };

  const run = async (id: number, action: () => Promise<{ data: AdminListingReview }>, done: string) => {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const result = await action();
      setRows((current) => current.map((row) => (row.id === id ? result.data : row)));
      setNotice(done);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save that action.");
    } finally {
      setBusyId(null);
      requestAnimationFrame(() => focusRow(id));
    }
  };

  const heading = <h1 className="font-poppins text-3xl font-bold text-white">Listing review</h1>;

  if (!isLoaded) {
    return (
      <section className="container py-10 space-y-4">
        {heading}
        <p className="text-white" role="status">Checking your sign-in</p>
      </section>
    );
  }
  if (!user) {
    return (
      <section className="container py-10 space-y-4">
        {heading}
        <p className="text-white">Sign in with a reviewer account to open listing review.</p>
        <Link className="btn btn-primary" href="/login?next=%2Fadmin%2Flistings">Sign in</Link>
      </section>
    );
  }
  if (user.role !== "STUDIO_ADMIN") {
    return (
      <section className="container py-10 space-y-4">
        {heading}
        <p className="text-white">This page is for Lodgist reviewers.</p>
      </section>
    );
  }

  return (
    <section className="container py-10 space-y-6">
      {heading}
      <p className="text-sm max-w-2xl" style={{ color: "rgba(255,255,255,0.65)" }}>
        Approve publishes a home as Lodgist-reviewed. The Verified badge is a separate action.
        Mark verified only after you have recorded the check yourself. You can do that before or after approve on this card.
        A refresh lists only homes still waiting for review. Example rows stay off the public list.
      </p>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      <p role="status" aria-live="polite" className="text-sm" style={{ color: "var(--color-teal)" }}>{notice}</p>
      {!loaded && !error && <p className="text-white">Loading listings</p>}
      {loaded && !error && rows.length === 0 && <p className="text-white">No listings are waiting for review.</p>}
      <ul className="space-y-4">
        {rows.map((listing) => {
          const busy = busyId === listing.id;
          const reasonId = `reason-${listing.id}`;
          const reasonError = reasonErrors[listing.id];
          return (
            <li key={listing.id} className="card space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 id={`listing-${listing.id}-title`} tabIndex={-1} className="font-poppins text-lg text-white break-words">{listing.title}</h2>
                  <p className="text-sm text-white">{placeOf(listing) || "Area not supplied"}</p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-orange)" }}>{formatYearlyRent(listing.price)}</p>
                </div>
                <p className="text-xs text-white break-words">Owner: {listing.owner?.name || "Unknown"}</p>
              </div>
              <p className="text-sm text-white">{listing.publicationState === "published" ? "Published" : listing.publicationState === "rejected" ? "Rejected" : "Waiting for review"} · {listing.reviewLabel}</p>
              <p className="text-sm" style={{ color: listing.evidenceVerified ? "var(--color-teal)" : "var(--color-orange)" }}>
                {listing.verificationLabel}
              </p>
              {listing.example && (
                <p className="text-sm" style={{ color: "var(--color-orange)" }}>Example only. It cannot be published or marked verified.</p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || listing.example || listing.publiclyListed}
                  onClick={() => run(listing.id, () => adminListingsApi.approve(listing.id), "Published. The home is Lodgist-reviewed, not verified.")}
                >
                  Approve<span className="sr-only"> {listing.title}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || listing.example || listing.evidenceVerified || listing.publicationState === "rejected"}
                  onClick={() => run(listing.id, () => adminListingsApi.verify(listing.id), "Verified badge recorded. Publishing is separate.")}
                >
                  Mark verified<span className="sr-only"> {listing.title}</span>
                </button>
                {listing.evidenceVerified && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove the Verified by Lodgist badge from "${listing.title}"?`)) return;
                      run(listing.id, () => adminListingsApi.unverify(listing.id), "Verified badge removed.");
                    }}
                  >
                    Remove verification<span className="sr-only"> {listing.title}</span>
                  </button>
                )}
              </div>
              <form
                noValidate
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = (reasons[listing.id] || "").trim();
                  if (!reason) {
                    setReasonErrors((current) => ({ ...current, [listing.id]: "A rejection reason is required." }));
                    document.getElementById(reasonId)?.focus();
                    return;
                  }
                  setReasonErrors((current) => ({ ...current, [listing.id]: "" }));
                  if (!window.confirm(`Reject "${listing.title}"? It will not be public.`)) return;
                  run(listing.id, () => adminListingsApi.reject(listing.id, reason), "Listing rejected. It is not public.");
                }}
              >
                <div className="flex-1 min-w-0">
                  <label className="label" htmlFor={reasonId}>Rejection reason (required)</label>
                  <input
                    id={reasonId}
                    className="input flex-1"
                    maxLength={500}
                    aria-required="true"
                    aria-invalid={reasonError ? true : undefined}
                    aria-describedby={reasonError ? `${reasonId}-error` : undefined}
                    value={reasons[listing.id] || ""}
                    placeholder="Reason for rejection"
                    onChange={(event) => setReasons((current) => ({ ...current, [listing.id]: event.target.value }))}
                  />
                  {reasonError && (
                    <p id={`${reasonId}-error`} role="alert" className="text-sm mt-1" style={{ color: "var(--color-orange)" }}>{reasonError}</p>
                  )}
                </div>
                <button type="submit" className="btn btn-secondary" disabled={busy}>Reject<span className="sr-only"> {listing.title}</span></button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
