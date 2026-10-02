"use client";

import { useEffect, useState } from "react";

const KEY = "lodgist-nekede-card";

type Card = {
  lodge: string;
  manager: string;
  phone: string;
  rent: string;
  agency: string;
  legal: string;
  caution: string;
  saw: string;
};

const EMPTY: Card = {
  lodge: "",
  manager: "",
  phone: "",
  rent: "",
  agency: "",
  legal: "",
  caution: "",
  saw: "",
};

function digits(value: string, max: number) {
  return value.replace(/\D/g, "").slice(0, max);
}

function naira(amount: string, yearly: boolean) {
  if (amount === "0") return yearly ? "\u20a60 / year" : "\u20a60";
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "Not recorded";
  const formatted = `\u20a6${n.toLocaleString("en-NG")}`;
  return yearly ? `${formatted} / year` : formatted;
}

function noteFor(card: Card) {
  return [
    `Confirmed with ${card.manager}.`,
    `One room at ${card.lodge}, near Federal Polytechnic Nekede.`,
    `Rent ${naira(card.rent, true)}.`,
    `Agency ${naira(card.agency, false)}.`,
    `Legal fee ${naira(card.legal, false)}.`,
    `Caution ${naira(card.caution, false)}.`,
    "Photos or video stay theirs, used only with permission.",
    "This is not a verified badge and not a Trust Score.",
    `Students enquire to ${card.phone}.`,
    "They can take the room down at any time.",
    "Not live until this matches the chat.",
  ].join(" ");
}

export default function NekedeRoomCard() {
  const [form, setForm] = useState(EMPTY);
  const [free, setFree] = useState(false);
  const [permission, setPermission] = useState(false);
  const [saved, setSaved] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Card;
      if (parsed?.lodge && parsed?.manager) setSaved(parsed);
    } catch {
      /* a bad local note is ignored */
    }
  }, []);

  function setField(key: keyof Card, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!free || !permission) {
      setError("Both boxes must be ticked. A social post is not a yes.");
      return;
    }
    if (form.lodge.trim().length < 2 || form.manager.trim().length < 2) {
      setError("The lodge and the person who said yes both need names.");
      return;
    }
    if (form.phone.length < 10) {
      setError("Their WhatsApp number is too short.");
      return;
    }
    if (!form.rent || form.rent === "0") {
      setError("Annual rent has to be a real figure.");
      return;
    }
    for (const key of ["agency", "legal", "caution"] as const) {
      if (form[key] === "") {
        setError("Type 0 if agency, legal, or caution is truly zero.");
        return;
      }
    }
    if (form.saw.trim().length < 8) {
      setError("Write what you actually saw, in one line.");
      return;
    }
    const next: Card = {
      lodge: form.lodge.trim(),
      manager: form.manager.trim(),
      phone: form.phone,
      rent: form.rent,
      agency: form.agency,
      legal: form.legal,
      caution: form.caution,
      saw: form.saw.trim(),
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    setSaved(next);
    setCopied(false);
  }

  const script = saved ? noteFor(saved) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="card text-left grid gap-4">
        <label className="text-sm text-white">
          Lodge
          <input id="lodge" className="input mt-1" value={form.lodge} onChange={(e) => setField("lodge", e.target.value)} placeholder="Name on the gate" autoComplete="organization" />
        </label>
        <label className="text-sm text-white">
          Person who said yes
          <input id="manager" className="input mt-1" value={form.manager} onChange={(e) => setField("manager", e.target.value)} placeholder="Their name" autoComplete="name" />
        </label>
        <label className="text-sm text-white">
          Their WhatsApp
          <input id="phone" className="input mt-1" inputMode="tel" value={form.phone} onChange={(e) => setField("phone", digits(e.target.value, 13))} placeholder="080…" autoComplete="tel" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            ["rent", "Annual rent"],
            ["agency", "Agency"],
            ["legal", "Legal fee"],
            ["caution", "Caution"],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-sm text-white">
              {label}
              <input id={key} className="input mt-1" inputMode="numeric" value={form[key]} onChange={(e) => setField(key, digits(e.target.value, 9))} placeholder="0 if it is truly zero" />
            </label>
          ))}
        </div>
        <label className="text-sm text-white">
          What you saw
          <input id="saw" className="input mt-1" value={form.saw} onChange={(e) => setField("saw", e.target.value)} placeholder="One line from the visit or their live video" />
        </label>
        <label className="flex items-start gap-3 text-sm text-white">
          <input id="free" type="checkbox" className="mt-1" checked={free} onChange={(e) => { setFree(e.target.checked); setError(""); }} />
          The room is free now, and this person can list it.
        </label>
        <label className="flex items-start gap-3 text-sm text-white">
          <input id="permission" type="checkbox" className="mt-1" checked={permission} onChange={(e) => { setPermission(e.target.checked); setError(""); }} />
          They allowed their photos or video to be used.
        </label>
        {error ? <p className="text-sm" style={{ color: "var(--color-orange)" }} role="alert">{error}</p> : null}
        <button type="submit" className="btn btn-primary">Write the card</button>
      </form>

      {saved ? (
        <section className="card text-left mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-orange)" }}>On this phone only · not published</p>
          <h2 className="font-poppins text-2xl font-bold text-white">{saved.lodge}</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>{saved.manager} · {saved.phone}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Rent</dt><dd className="text-white font-semibold">{naira(saved.rent, true)}</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Agency</dt><dd className="text-white font-semibold">{naira(saved.agency, false)}</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Legal</dt><dd className="text-white font-semibold">{naira(saved.legal, false)}</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Caution</dt><dd className="text-white font-semibold">{naira(saved.caution, false)}</dd></div>
          </dl>
          <p className="text-sm text-white mt-4">{saved.saw}</p>
          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>Not a verified badge. Not a Trust Score. These figures are not a bill.</p>
          <p id="nekede-script" className="text-sm mt-4" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.6 }}>{script}</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={() => void copy()}>{copied ? "Copied" : "Copy the note"}</button>
        </section>
      ) : null}
    </div>
  );
}
