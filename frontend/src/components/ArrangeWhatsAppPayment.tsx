"use client";

import { useState } from "react";

export default function ArrangeWhatsAppPayment({
  href,
  label,
  busyLabel,
  note,
  missingLabel,
  prepare,
}: {
  href: string | null;
  label: string;
  busyLabel: string;
  note: string;
  missingLabel: string;
  prepare?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!href) {
    return <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{missingLabel}</p>;
  }

  return (
    <div>
      <button
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
      </button>
      <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.55)" }}>{note}</p>
      {error && (
        <p role="alert" className="text-sm mt-2" style={{ color: "var(--color-orange)" }}>{error}</p>
      )}
    </div>
  );
}
