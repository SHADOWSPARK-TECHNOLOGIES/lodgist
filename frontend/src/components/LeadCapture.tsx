"use client";

import { useState } from "react";
import { ApiError, leadsApi } from "@/lib/api";
import { listings as copy } from "@/lib/copy";

type Props = {
  initialLocation?: string;
  initialBudget?: string;
};

export default function LeadCapture({ initialLocation = "", initialBudget = "" }: Props) {
  const [location, setLocation] = useState(initialLocation);
  const [budget, setBudget] = useState(initialBudget);
  const [bedrooms, setBedrooms] = useState("2");
  const [moveInTimeframe, setMoveInTimeframe] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  if (saved) {
    return (
      <p className="text-sm mb-6" role="status" style={{ color: "rgba(255,255,255,0.8)" }}>{saved}</p>
    );
  }

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError("");
    const budgetNumber = Number(budget);
    const bedroomNumber = Number(bedrooms);
    try {
      const res = await leadsApi.create({
        location: location.trim(),
        budget: budgetNumber,
        bedrooms: bedroomNumber,
        moveInTimeframe: moveInTimeframe.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setSaved(res.message || copy.leadSaved);
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : copy.leadFailed;
      setError(message || copy.leadFailed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="card text-left max-w-md mx-auto mb-6 space-y-3">
      <h3 className="font-poppins font-semibold text-white">{copy.leadTitle}</h3>
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{copy.leadBody}</p>
      <div>
        <label className="label" htmlFor="lead-location">{copy.leadLocation}</label>
        <input id="lead-location" className="input w-full" required minLength={2} maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="lead-budget">{copy.leadBudget}</label>
        <input id="lead-budget" className="input w-full" required inputMode="numeric" min={1} value={budget} onChange={(event) => setBudget(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="lead-bedrooms">{copy.leadBedrooms}</label>
        <input id="lead-bedrooms" className="input w-full" required type="number" min={0} max={20} step={1} value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="lead-move">{copy.leadMoveIn}</label>
        <input id="lead-move" className="input w-full" required minLength={2} maxLength={80} placeholder="Within 1 month" value={moveInTimeframe} onChange={(event) => setMoveInTimeframe(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="lead-phone">{copy.leadPhone}</label>
        <input id="lead-phone" className="input w-full" required inputMode="tel" autoComplete="tel" placeholder="080..." value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="lead-email">{copy.leadEmail}</label>
        <input id="lead-email" className="input w-full" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--color-orange)" }}>{error}</p>}
      <button type="submit" className="btn btn-primary w-full justify-center" disabled={sending}>
        {sending ? copy.leadSending : copy.leadSubmit}
      </button>
    </form>
  );
}
