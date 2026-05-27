"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Shield, CheckCircle, Loader2, ArrowLeft, Phone, MapPin, Wallet, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  listingUrl: string;
  address: string;
  contactNumber: string;
  claimedRent: string;
  additionalNotes: string;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
              i < current
                ? "bg-[#1ABC9C] text-white"
                : i === current
                  ? "border-2 border-[#1ABC9C] text-[#1ABC9C]"
                  : "border-2 border-gray-200 text-gray-400",
            )}
          >
            {i < current ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          {i < total - 1 && (
            <div
              className={cn(
                "h-0.5 w-8 transition-colors",
                i < current ? "bg-[#1ABC9C]" : "bg-gray-200",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Form Fields ──────────────────────────────────────────────────────────────

function InputField({
  label, icon: Icon, ...props
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-[#0B1B2B]">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </label>
      <input
        {...props}
        className={cn(
          "block w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]",
          props.className,
        )}
      />
    </div>
  );
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

function ConfirmationScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1ABC9C]/10">
        <CheckCircle className="h-8 w-8 text-[#1ABC9C]" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-[#0B1B2B]">Verification Request Submitted</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          Our team will review this listing within 24–48 hours. You&apos;ll receive an update via WhatsApp or email.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset}>
          Verify Another
        </Button>
        <Link href="/search">
          <Button className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c]">
            Browse Properties
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyPage() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    listingUrl: "",
    address: "",
    contactNumber: "",
    claimedRent: "",
    additionalNotes: "",
  });

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitted(true);
  }

  // ─── Submitted state ─────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
                <rect width="36" height="36" rx="8" fill="#0B1B2B" />
                <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
                <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
              </svg>
              <span className="text-lg font-bold text-[#0B1B2B]">Lodgist</span>
            </Link>
          </div>
        </nav>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Card>
            <CardContent className="p-8">
              <ConfirmationScreen onReset={() => { setSubmitted(false); setStep(0); setForm({ listingUrl: "", address: "", contactNumber: "", claimedRent: "", additionalNotes: "" }); }} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0B1B2B" />
              <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
              <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
            </svg>
            <span className="text-lg font-bold text-[#0B1B2B]">Lodgist</span>
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* ── Title ──────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1ABC9C]/10 px-4 py-1.5 text-xs font-semibold text-[#1ABC9C]">
            <Shield className="h-3.5 w-3.5" />
            Verification Request
          </div>
          <h1 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">
            Request a Listing Verification
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Not sure about a listing? Our team will manually verify it and provide a detailed trust report.
          </p>
        </div>

        {/* ── Steps ──────────────────────────────────────────────────────── */}
        <div className="mb-8 flex justify-center">
          <StepIndicator current={step} total={3} />
        </div>

        {/* ── Form Card ──────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Step 1: Listing Info */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-[#0B1B2B]">Listing Information</h2>
                    <p className="text-sm text-muted-foreground">
                      Tell us which listing you want us to verify.
                    </p>
                  </div>

                  <InputField
                    label="Listing URL or ID"
                    icon={LinkIcon}
                    type="text"
                    placeholder="e.g. lodgist.ng/listings/123 or listing ID"
                    value={form.listingUrl}
                    onChange={(e) => updateField("listingUrl", e.target.value)}
                    required
                  />

                  <InputField
                    label="Property Address"
                    icon={MapPin}
                    type="text"
                    placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
                    value={form.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    required
                  />

                  <div className="flex justify-end">
                    <Button type="button" onClick={() => setStep(1)} className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c]">
                      Next — Contact Details
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Contact Info */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-[#0B1B2B]">Your Contact Details</h2>
                    <p className="text-sm text-muted-foreground">
                      So we can reach you with the verification results.
                    </p>
                  </div>

                  <InputField
                    label="Phone Number / WhatsApp"
                    icon={Phone}
                    type="tel"
                    placeholder="e.g. 08031234567"
                    value={form.contactNumber}
                    onChange={(e) => updateField("contactNumber", e.target.value)}
                    required
                  />

                  <InputField
                    label="Claimed Rent Amount (₦)"
                    icon={Wallet}
                    type="number"
                    placeholder="e.g. 4500000"
                    value={form.claimedRent}
                    onChange={(e) => updateField("claimedRent", e.target.value)}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-[#0B1B2B]">
                      Additional Notes (optional)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Anything else we should know? e.g. suspicious behaviour, inconsistent photos..."
                      value={form.additionalNotes}
                      onChange={(e) => updateField("additionalNotes", e.target.value)}
                      className={cn(
                        "block w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm",
                        "placeholder:text-muted-foreground",
                        "focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]",
                      )}
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep(2)} className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c]">
                      Next — Review & Submit
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Submit */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-[#0B1B2B]">Review Your Request</h2>
                    <p className="text-sm text-muted-foreground">
                      Please confirm the information before submitting.
                    </p>
                  </div>

                  <div className="space-y-3 rounded-lg bg-gray-50 p-4">
                    <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                      <span className="text-muted-foreground">Listing URL:</span>
                      <span className="font-medium text-[#0B1B2B]">{form.listingUrl}</span>
                      <span className="text-muted-foreground">Address:</span>
                      <span className="font-medium text-[#0B1B2B]">{form.address}</span>
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="font-medium text-[#0B1B2B]">{form.contactNumber}</span>
                      <span className="text-muted-foreground">Claimed Rent:</span>
                      <span className="font-medium text-[#0B1B2B]">
                        {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(Number(form.claimedRent))}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <strong>Note:</strong> Manual verification typically takes 24–48 hours. You&apos;ll receive
                    the result via WhatsApp or SMS. This service is free for all Lodgist users.
                  </div>

                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" />
                          Submit Verification Request
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* ── Trust Note ─────────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your data is handled securely and only used for verification purposes.{' '}
          <Link href="/" className="font-medium text-[#1ABC9C] hover:underline">
            Read our privacy policy
          </Link>
        </p>
      </div>
    </div>
  );
}
