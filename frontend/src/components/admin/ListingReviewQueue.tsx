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

  const load = async () => {
    const body = await adminListingsApi.pending();
    setRows(body.data);
  };

  useEffect(() => {
    if (!isLoaded || user?.role !== "STUDIO_ADMIN") return;
    load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Could not load listings.");
    });
  }, [isLoaded, user]);

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
    }
  };

  if (!isLoaded) return <p className="container py-10 text-white">Loading</p>;
  if (!user) {
    return (
      <section className="container py-10">
        <p className="text-white mb-4">Sign in with a reviewer account to open listing review.</p>
        <Link className="btn btn-primary" href="/login">Sign in</Link>
      </section>
    );
  }
  if (user.role !== "STUDIO_ADMIN") {
    return <p className="container py-10 text-white">This page is for Lodgist reviewers.</p>;
  }

  return (
    <section className="container py-10 space-y-6">
      <h1 className="font-poppins text-3xl font-bold text-white">Listing review</h1>
      <p className="text-sm max-w-2xl" style={{ color: "rgba(255,255,255,0.65)" }}>
        Approve publishes a home as Lodgist-reviewed. The Verified badge is a separate action.
        Mark verified only after you have recorded the check yourself. You can do that before or after approve on this card.
        A refresh lists only homes still waiting for review. Example rows stay off the public list.
      </p>
      {error && <p role="alert" className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      {notice && <p className="text-sm" style={{ color: "var(--color-teal)" }}>{notice}</p>}
      {rows.length === 0 && <p className="text-white">No listings are waiting for review.</p>}
      <ul className="space-y-4">
        {rows.map((listing) => {
          const busy = busyId === listing.id;
          return (
            <li key={listing.id} className="card space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-poppins text-lg text-white">{listing.title}</h2>
                  <p className="text-sm text-white">{placeOf(listing) || "Area not supplied"}</p>
                  <p className="text-sm mt-1" style={{ color: "var(--color-orange)" }}>{formatYearlyRent(listing.price)}</p>
                </div>
                <p className="text-xs text-white">Owner: {listing.owner?.name || "Unknown"}</p>
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
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || listing.example || listing.evidenceVerified}
                  onClick={() => run(listing.id, () => adminListingsApi.verify(listing.id), "Verified badge recorded. Publishing is separate.")}
                >
                  Mark verified
                </button>
                {listing.evidenceVerified && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => run(listing.id, () => adminListingsApi.unverify(listing.id), "Verified badge removed.")}
                  >
                    Remove verification
                  </button>
                )}
              </div>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = (reasons[listing.id] || "").trim();
                  if (!reason) {
                    setError("A rejection reason is required.");
                    return;
                  }
                  run(listing.id, () => adminListingsApi.reject(listing.id, reason), "Listing rejected. It is not public.");
                }}
              >
                <label className="sr-only" htmlFor={`reason-${listing.id}`}>Rejection reason</label>
                <input
                  id={`reason-${listing.id}`}
                  className="input flex-1"
                  maxLength={500}
                  value={reasons[listing.id] || ""}
                  placeholder="Reason for rejection"
                  onChange={(event) => setReasons((current) => ({ ...current, [listing.id]: event.target.value }))}
                />
                <button type="submit" className="btn btn-secondary" disabled={busy}>Reject</button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
