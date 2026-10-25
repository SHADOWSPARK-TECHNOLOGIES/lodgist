"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError, rentalChecksApi } from "@/lib/api";
import { formatNaira, RENTAL_PRICE_NGN } from "@/lib/rentalCheck";

export default function CheckIntake() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [askingRent, setAskingRent] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const rent = Number(askingRent.replace(/[, ]/g, ""));
    if (!Number.isInteger(rent) || rent < 1) {
      setError("Enter the asking rent as a whole number of naira.");
      return;
    }
    const paymentDetails =
      bankName || accountName || accountNumber
        ? {
            method: "bank_transfer" as const,
            bankName: bankName || null,
            accountName: accountName || null,
            accountNumber: accountNumber || null,
          }
        : null;
    setSending(true);
    try {
      const result = await rentalChecksApi.create({
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim(),
        listingUrl: listingUrl.trim() || undefined,
        location: location.trim(),
        askingRent: rent,
        agentName: agentName.trim() || undefined,
        agentPhone: agentPhone.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        paymentDetails,
      });
      const token = result.data.accessToken;
      if (!token) {
        setError("The case was saved, but the link token was missing. Contact Lodgist with your phone number.");
        return;
      }
      router.push(`/check/${encodeURIComponent(result.data.publicReference)}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We could not save this case.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="container py-10">
      <div className="max-w-xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-orange)" }}>
          Rental Safety Check · {formatNaira(RENTAL_PRICE_NGN)}
        </p>
        <h1 className="font-poppins text-3xl font-bold text-white mb-3">Check a rental before you pay</h1>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.7)" }}>
          Found a house online? Before you send money, let Lodgist check it. This is a review of the information you
          send. It is not a statement that the home is verified.
        </p>
        <form onSubmit={onSubmit} className="card space-y-4 text-left">
          <label className="block text-sm text-white">
            Listing link (optional)
            <input className="input mt-1" value={listingUrl} onChange={(e) => setListingUrl(e.target.value)} placeholder="https://" inputMode="url" />
          </label>
          <label className="block text-sm text-white">
            Location
            <input className="input mt-1" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Area and city" />
          </label>
          <label className="block text-sm text-white">
            Asking rent (naira)
            <input className="input mt-1" required value={askingRent} onChange={(e) => setAskingRent(e.target.value)} inputMode="numeric" placeholder="800000" />
          </label>
          <label className="block text-sm text-white">
            Landlord or agent name (optional)
            <input className="input mt-1" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          </label>
          <label className="block text-sm text-white">
            Landlord or agent phone (optional)
            <input className="input mt-1" value={agentPhone} onChange={(e) => setAgentPhone(e.target.value)} inputMode="tel" />
          </label>
          <label className="block text-sm text-white">
            Your WhatsApp number
            <input className="input mt-1" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="080..." />
          </label>
          <label className="block text-sm text-white">
            Your name (optional)
            <input className="input mt-1" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" />
          </label>
          <fieldset className="space-y-3">
            <legend className="text-sm text-white">Payment details they gave you (optional)</legend>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
              Bank name and account are evidence for the review. Do not send card numbers, PINs, or OTPs.
            </p>
            <label className="block text-sm text-white" htmlFor="rental-bank-name">
              Bank name
              <input id="rental-bank-name" className="input mt-1" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" />
            </label>
            <label className="block text-sm text-white" htmlFor="rental-account-name">
              Account name
              <input id="rental-account-name" className="input mt-1" value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Account name" />
            </label>
            <label className="block text-sm text-white" htmlFor="rental-account-number">
              Account number
              <input id="rental-account-number" className="input mt-1" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="10-digit account number" inputMode="numeric" />
            </label>
          </fieldset>
          <label className="block text-sm text-white">
            Notes (optional)
            <textarea className="input mt-1" rows={4} value={customerNotes} onChange={(e) => setCustomerNotes(e.target.value)} />
          </label>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            Screenshot upload is not available. Describe what you saw in the notes.
          </p>
          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--color-orange)" }}>
              {error}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
            The check fee is {formatNaira(RENTAL_PRICE_NGN)}. Saving this case does not pay it. On the next page you arrange payment on WhatsApp. The Lodgist team confirms it.
          </p>
          <button className="btn btn-primary w-full" type="submit" disabled={sending} style={{ whiteSpace: "normal" }}>
            {sending ? "Saving" : "Save this case"}
          </button>
        </form>
      </div>
    </section>
  );
}
