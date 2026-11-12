"use client";

import { useState } from "react";

export default function ArrangeWhatsAppPayment({
  href,
  label,
  busyLabel,
  note,
  missingLabel,
  emailHref,
  emailLabel,
  prepare,
}: {
  href: string | null;
  label: string;
  busyLabel: string;
  note: string;
  missingLabel: string;
  emailHref?: string | null;
  emailLabel?: string;
  prepare?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!href && !emailHref) {
    return <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{missingLabel}</p>;
  }

  return (
    <div>
      {href && <button
        type="button"
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            if (prepare) await prepare();
            window.location.assign(href);
          } catch (err) {
            setError(err instanceof Error ? err.message : "We could not open WhatsApp.");
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : label}
      </button>}
      {emailHref && (
        <a href={emailHref} className="btn btn-secondary w-full mt-2">
          {emailLabel || "Contact support by email"}
        </a>
      )}
      <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>{note}</p>
      {error && (
        <p role="alert" className="text-sm mt-2" style={{ color: "var(--color-orange)" }}>{error}</p>
      )}
    </div>
  );
}
