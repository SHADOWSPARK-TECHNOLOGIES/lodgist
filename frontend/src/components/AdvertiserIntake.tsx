"use client";

import { useState } from "react";
import { ApiError, advertiserLeadsApi } from "@/lib/api";
import { advertise as copy, supportWhatsAppLink } from "@/lib/copy";

export default function AdvertiserIntake() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("FUTO / Owerri");
  const [propertyCount, setPropertyCount] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const wa = supportWhatsAppLink(
    "Hi Lodgist — I want to advertise rooms in Owerri. Please agree scope and fee with me. (Payment does not buy a verification badge.)",
  );

  if (saved) {
    return (
      <div className="card text-left max-w-md mx-auto space-y-3">
        <p className="text-sm" role="status" style={{ color: "rgba(255,255,255,0.85)" }}>
          {saved}
        </p>
        {wa && (
          <a href={wa} className="btn btn-secondary w-full justify-center" target="_blank" rel="noopener noreferrer">
            {copy.waCta}
          </a>
        )}
      </div>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const count = propertyCount.trim() ? Number(propertyCount) : undefined;
      const res = await advertiserLeadsApi.create({
        name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        ...(count && Number.isFinite(count) ? { propertyCount: count } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setSaved(res.message || copy.saved);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : copy.failed;
      setError(message || copy.failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card text-left max-w-md mx-auto space-y-3">
      <div>
        <label className="label" htmlFor="adv-name">{copy.name}</label>
        <input id="adv-name" className="input w-full" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="adv-phone">{copy.phone}</label>
        <input id="adv-phone" className="input w-full" required inputMode="tel" autoComplete="tel" placeholder="080..." value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="adv-area">{copy.area}</label>
        <input id="adv-area" className="input w-full" required minLength={2} maxLength={120} value={area} onChange={(e) => setArea(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="adv-count">{copy.propertyCount}</label>
        <input id="adv-count" className="input w-full" type="number" min={1} max={500} step={1} value={propertyCount} onChange={(e) => setPropertyCount(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="adv-notes">{copy.notes}</label>
        <textarea id="adv-notes" className="input w-full" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="adv-email">{copy.email}</label>
        <input id="adv-email" className="input w-full" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      <button type="submit" className="btn btn-primary w-full justify-center" disabled={sending}>
        {sending ? copy.sending : copy.submit}
      </button>
      {wa && (
        <a href={wa} className="btn btn-secondary w-full justify-center" target="_blank" rel="noopener noreferrer">
          {copy.waCta}
        </a>
      )}
    </form>
  );
}
