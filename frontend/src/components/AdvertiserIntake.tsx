"use client";

import { useState } from "react";
import { ApiError, advertiserLeadsApi } from "@/lib/api";
import { advertise as copy, supportWhatsAppLink } from "@/lib/copy";
import type {
  AdvertiserAuthority,
  AdvertiserAvailability,
  AdvertiserRentPeriod,
  MoveInFeeInput,
} from "@/lib/types";

const FEE_FIELDS = [
  ["baseRent", copy.baseRent],
  ["agency", copy.agency],
  ["legal", copy.legal],
  ["caution", copy.caution],
  ["inspection", copy.inspection],
] as const;

type FeeKey = (typeof FEE_FIELDS)[number][0];

type FeeDraft = { mode: "" | "known" | "unknown"; amount: string };

const emptyFees = (): Record<FeeKey, FeeDraft> => ({
  baseRent: { mode: "", amount: "" },
  agency: { mode: "", amount: "" },
  legal: { mode: "", amount: "" },
  caution: { mode: "", amount: "" },
  inspection: { mode: "", amount: "" },
});

function feePayload(draft: FeeDraft): MoveInFeeInput | null {
  if (draft.mode === "unknown") return { known: false };
  if (draft.mode !== "known") return null;
  if (!/^\d+$/.test(draft.amount.trim())) return null;
  return { known: true, amountNgn: Number(draft.amount.trim()) };
}

export default function AdvertiserIntake() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [propertyCount, setPropertyCount] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState("");
  const [authority, setAuthority] = useState<AdvertiserAuthority | "">("");
  const [photoPublicationAllowed, setPhotoPublicationAllowed] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<AdvertiserAvailability | "">("");
  const [availableFrom, setAvailableFrom] = useState("");
  const [rentPeriod, setRentPeriod] = useState<AdvertiserRentPeriod | "">("");
  const [fees, setFees] = useState(emptyFees);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const wa = supportWhatsAppLink(
    "Hi Lodgist — I want to advertise a home. Please agree scope and fee with me. Payment never buys a verification badge. Submission is not publication.",
  );

  if (saved) {
    return (
      <div className="card text-left max-w-lg mx-auto space-y-3">
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

  const setFee = (key: FeeKey, patch: Partial<FeeDraft>) => {
    setFees((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!authority || photoPublicationAllowed === null || !availability || !rentPeriod) {
      setError(copy.failed);
      return;
    }
    if (availability === "FROM_DATE" && !availableFrom) {
      setError(copy.failed);
      return;
    }
    const moveInFees = {
      baseRent: feePayload(fees.baseRent),
      agency: feePayload(fees.agency),
      legal: feePayload(fees.legal),
      caution: feePayload(fees.caution),
      inspection: feePayload(fees.inspection),
    };
    if (Object.values(moveInFees).some((fee) => !fee)) {
      setError(copy.failed);
      return;
    }
    setSending(true);
    try {
      const count = propertyCount.trim() ? Number(propertyCount) : undefined;
      const res = await advertiserLeadsApi.create({
        name: name.trim(),
        phone: phone.trim(),
        area: area.trim(),
        ...(count && Number.isFinite(count) ? { propertyCount: count } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        authority,
        photoPublicationAllowed,
        availability,
        ...(availability === "FROM_DATE" ? { availableFrom } : {}),
        rentPeriod,
        moveInFees: {
          baseRent: moveInFees.baseRent!,
          agency: moveInFees.agency!,
          legal: moveInFees.legal!,
          caution: moveInFees.caution!,
          inspection: moveInFees.inspection!,
        },
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
    <form onSubmit={onSubmit} className="card text-left max-w-lg mx-auto space-y-3">
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
        <input id="adv-area" className="input w-full" required minLength={2} maxLength={120} placeholder={copy.areaPlaceholder} value={area} onChange={(e) => setArea(e.target.value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="label">{copy.authority}</legend>
        <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          <input type="radio" name="authority" required checked={authority === "CONTROLS"} onChange={() => setAuthority("CONTROLS")} />
          {copy.authorityControls}
        </label>
        <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          <input type="radio" name="authority" required checked={authority === "AUTHORIZED"} onChange={() => setAuthority("AUTHORIZED")} />
          {copy.authorityAuthorized}
        </label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="label">{copy.photos}</legend>
        <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          <input type="radio" name="photos" required checked={photoPublicationAllowed === true} onChange={() => setPhotoPublicationAllowed(true)} />
          {copy.photosYes}
        </label>
        <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
          <input type="radio" name="photos" required checked={photoPublicationAllowed === false} onChange={() => setPhotoPublicationAllowed(false)} />
          {copy.photosNo}
        </label>
      </fieldset>
      <div>
        <label className="label" htmlFor="adv-availability">{copy.availability}</label>
        <select id="adv-availability" className="input w-full" required value={availability} onChange={(e) => setAvailability(e.target.value as AdvertiserAvailability | "")}>
          <option value="">Select</option>
          <option value="AVAILABLE_NOW">{copy.availableNow}</option>
          <option value="FROM_DATE">{copy.availableFrom}</option>
          <option value="NOT_AVAILABLE">{copy.notAvailable}</option>
        </select>
      </div>
      {availability === "FROM_DATE" && (
        <div>
          <label className="label" htmlFor="adv-from">{copy.availableFromDate}</label>
          <input id="adv-from" className="input w-full" type="date" required value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="adv-rent">{copy.rentPeriod}</label>
        <select id="adv-rent" className="input w-full" required value={rentPeriod} onChange={(e) => setRentPeriod(e.target.value as AdvertiserRentPeriod | "")}>
          <option value="">Select</option>
          <option value="MONTH">{copy.rentMonth}</option>
          <option value="YEAR">{copy.rentYear}</option>
          <option value="SEMESTER">{copy.rentSemester}</option>
        </select>
      </div>
      <fieldset className="space-y-3">
        <legend className="label">{copy.feesTitle}</legend>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>{copy.feesHint}</p>
        {FEE_FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>{label}</p>
            <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              <input type="radio" name={`fee-${key}`} required checked={fees[key].mode === "unknown"} onChange={() => setFee(key, { mode: "unknown", amount: "" })} />
              {copy.feeUnknown}
            </label>
            <label className="flex gap-2 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              <input type="radio" name={`fee-${key}`} required checked={fees[key].mode === "known"} onChange={() => setFee(key, { mode: "known" })} />
              {copy.feeKnown}
            </label>
            {fees[key].mode === "known" && (
              <input
                className="input w-full"
                inputMode="numeric"
                required
                min={0}
                step={1}
                pattern="[0-9]+"
                aria-label={label}
                value={fees[key].amount}
                onChange={(e) => setFee(key, { amount: e.target.value })}
              />
            )}
          </div>
        ))}
      </fieldset>
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
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>{copy.rule}</p>
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
