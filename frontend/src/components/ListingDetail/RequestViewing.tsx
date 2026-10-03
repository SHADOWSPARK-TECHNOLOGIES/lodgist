"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, listingsApi } from "@/lib/api";
import { detail } from "@/lib/copy";
import { track } from "@/lib/gtag";
import type { ViewingRequestResult } from "@/lib/types";
import { viewingStatusText } from "@/lib/viewingStatus";
import { useAuth } from "@/context/AuthContext";

type Props = {
  listingId: number;
  loginHref: string;
  askHref: string | null;
};

function isRenter(role: string | undefined): boolean {
  return role === "USER" || role === "TENANT";
}

function todayInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function RequestViewing({ listingId, loginHref, askHref }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    duplicate: boolean;
    savedNow: boolean;
    data: ViewingRequestResult;
  } | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!user || !isRenter(user.role)) return;
    let cancelled = false;
    listingsApi.myViewing(listingId)
      .then((res) => {
        const row = res.data;
        if (cancelled || !row) return;
        setResult((current) => current ?? { duplicate: false, savedNow: false, data: row });
      })
      .catch(() => {
        if (!cancelled) setError(detail.viewingStatusFailed);
      });
    return () => {
      cancelled = true;
    };
  }, [user, listingId]);

  if (!ready) {
    return <div className="skeleton h-24 w-full mb-4" />;
  }

  if (!user) {
    return (
      <div className="mb-4">
        <Link href={loginHref} className="btn btn-primary">{detail.signInToRequest}</Link>
      </div>
    );
  }

  if (!isRenter(user.role)) {
    return (
      <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.65)" }}>{detail.viewingLandlord}</p>
    );
  }

  if (result) {
    return (
      <section className="card mb-4" aria-live="polite">
        <h2 className="font-poppins font-semibold text-white mb-2">{detail.requestViewing}</h2>
        <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.75)" }}>
          {result.savedNow
            ? (result.duplicate ? detail.viewingDuplicate : detail.viewingNext)
            : detail.viewingExisting}
        </p>
        <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>{detail.viewingReference}</p>
        <p className="font-poppins font-bold text-xl mb-3" style={{ color: "var(--color-teal)" }}>#{result.data.id}</p>
        <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.75)" }}>
          {result.data.preferredDate}
          {result.data.preferredTime ? ` · ${result.data.preferredTime}` : ""}
        </p>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.75)" }}>{viewingStatusText(result.data.status)}</p>
        {askHref && (
          <a className="btn btn-secondary" href={askHref} target="_blank" rel="noopener noreferrer">{detail.whatsApp}</a>
        )}
      </section>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const saved = await listingsApi.requestViewing(listingId, {
        preferredDate,
        ...(preferredTime ? { preferredTime } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult({ duplicate: saved.duplicate, savedNow: true, data: saved.data });
      track("viewing_request", {
        listing_id: String(listingId),
        duplicate: saved.duplicate ? "true" : "false",
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(loginHref);
        return;
      }
      const message = err instanceof Error ? err.message : detail.viewingFailed;
      setError(message || detail.viewingFailed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card mb-4 space-y-4">
      <h2 className="font-poppins font-semibold text-white">{detail.requestViewing}</h2>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{detail.inspectionBody}</p>
      <div>
        <label className="label" htmlFor="viewing-date">{detail.viewingDate}</label>
        <input
          id="viewing-date"
          type="date"
          className="input w-full"
          required
          min={todayInputValue()}
          value={preferredDate}
          onChange={(event) => setPreferredDate(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="viewing-time">{detail.viewingTime}</label>
        <input
          id="viewing-time"
          type="time"
          className="input w-full"
          value={preferredTime}
          onChange={(event) => setPreferredTime(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="viewing-notes">{detail.viewingNotes}</label>
        <textarea
          id="viewing-notes"
          className="input w-full"
          rows={3}
          maxLength={400}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      <button type="submit" disabled={submitting} className="btn btn-primary w-full justify-center">
        {submitting ? detail.viewingSending : detail.viewingSubmit}
      </button>
    </form>
  );
}
