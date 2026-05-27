"use client";

import { useState, useRef, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Shield, CheckCircle, Loader2, ArrowLeft, Upload, X, FileText, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FileEntry {
  file: File;
  field: string;
  label: string;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
const MAX_MB = 5;

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only PDF, JPG, and PNG files are accepted.";
  if (file.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB} MB.`;
  return null;
}

// ─── File Drop Zone ───────────────────────────────────────────────────────────

function FileDropZone({
  label, fieldName, required = false, onFile, file, error,
}: {
  label: string; fieldName: string; required?: boolean;
  onFile: (f: File | null) => void; file: File | null; error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-[#0B1B2B]">
        {label}
        {required && <span className="text-[#FF6F3C]">*</span>}
      </label>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-[#1ABC9C]/30 bg-[#1ABC9C]/5 px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-[#1ABC9C]" />
          <span className="flex-1 truncate text-sm text-[#0B1B2B]">{file.name}</span>
          <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <button onClick={() => onFile(null)} className="text-gray-400 hover:text-red-500 transition">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
            dragging ? "border-[#1ABC9C] bg-[#1ABC9C]/5" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
          )}
        >
          <Upload className="h-5 w-5 text-gray-400" />
          <p className="text-sm text-gray-500">
            Drag & drop or <span className="font-medium text-[#FF6F3C]">choose file</span>
          </p>
          <p className="text-xs text-gray-400">PDF, JPG, PNG · max {MAX_MB} MB</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        name={fieldName}
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ listingId }: { listingId: string }) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-5 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1ABC9C]/10">
        <CheckCircle className="h-10 w-10 text-[#1ABC9C]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[#0B1B2B]">Verification Submitted</h2>
        <p className="max-w-sm text-sm text-gray-500 leading-relaxed">
          We have received your documents. Our team will review within 2–5 business days.
          You will be notified by email when the status changes.
        </p>
      </div>
      <Button
        onClick={() => router.push(`/listings/${listingId}`)}
        className="bg-[#1ABC9C] text-white hover:bg-[#15a082]"
      >
        View Listing
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VerifyListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [titleDoc, setTitleDoc] = useState<File | null>(null);
  const [ownerId, setOwnerId] = useState<File | null>(null);
  const [extra1, setExtra1] = useState<File | null>(null);
  const [extra2, setExtra2] = useState<File | null>(null);
  const [extra3, setExtra3] = useState<File | null>(null);
  const [consent1, setConsent1] = useState(false);
  const [consent2, setConsent2] = useState(false);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(`/login?callbackUrl=/verify/${listingId}`);
    }
  }, [status, listingId, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#1ABC9C]" />
      </div>
    );
  }

  if (!session) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // Validate required files
    if (!titleDoc) newErrors.titleDoc = "Title document is required.";
    else { const err = validateFile(titleDoc); if (err) newErrors.titleDoc = err; }

    if (ownerId) { const err = validateFile(ownerId); if (err) newErrors.ownerId = err; }
    if (extra1) { const err = validateFile(extra1); if (err) newErrors.extra1 = err; }
    if (extra2) { const err = validateFile(extra2); if (err) newErrors.extra2 = err; }
    if (extra3) { const err = validateFile(extra3); if (err) newErrors.extra3 = err; }

    if (!consent1) newErrors.consent1 = "You must confirm ownership or authorisation.";
    if (!consent2) newErrors.consent2 = "You must consent to verification.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    setServerError("");

    const body = new FormData();
    body.append("titleDoc", titleDoc!);
    if (ownerId) body.append("ownerId", ownerId);
    if (extra1) body.append("additional1", extra1);
    if (extra2) body.append("additional2", extra2);
    if (extra3) body.append("additional3", extra3);
    if (notes) body.append("notes", notes);

    try {
      const res = await fetch(`/api/listings/${listingId}/verify`, {
        method: "POST",
        body,
      });

      if (res.status === 409) {
        setServerError("A verification request is already in progress for this listing.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data.message ?? "Submission failed. Please try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={`/listings/${listingId}`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#0B1B2B] transition"
          >
            <ArrowLeft className="h-4 w-4" /> Back to listing
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0B1B2B" />
              <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
              <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
            </svg>
            <span className="font-bold text-[#0B1B2B]">Lodgist</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#1ABC9C]/10 px-4 py-1.5 text-xs font-semibold text-[#1ABC9C]">
            <Shield className="h-3.5 w-3.5" />
            Property Verification
          </div>
          <h1 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">Verify This Property</h1>
          <p className="text-sm text-gray-500">
            Submit documents for review. Our team will verify within 2–5 business days.
          </p>
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          {success ? (
            <div className="p-8">
              <SuccessScreen listingId={listingId} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="divide-y">
              {/* Section 1: Documents */}
              <div className="space-y-5 p-6 sm:p-8">
                <div>
                  <h2 className="font-semibold text-[#0B1B2B]">Document Upload</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Upload proof of ownership and identity. PDF, JPG or PNG, max 5 MB each.
                  </p>
                </div>

                <FileDropZone
                  label="Title Document (C of O, Deed of Assignment, Survey Plan)"
                  fieldName="titleDoc"
                  required
                  onFile={setTitleDoc}
                  file={titleDoc}
                  error={errors.titleDoc}
                />
                <FileDropZone
                  label="Government-issued ID of Property Owner"
                  fieldName="ownerId"
                  onFile={setOwnerId}
                  file={ownerId}
                  error={errors.ownerId}
                />
                <FileDropZone
                  label="Additional Document (optional)"
                  fieldName="additional1"
                  onFile={setExtra1}
                  file={extra1}
                  error={errors.extra1}
                />
                {(extra1 || extra2) && (
                  <FileDropZone
                    label="Additional Document 2 (optional)"
                    fieldName="additional2"
                    onFile={setExtra2}
                    file={extra2}
                    error={errors.extra2}
                  />
                )}
                {extra2 && (
                  <FileDropZone
                    label="Additional Document 3 (optional)"
                    fieldName="additional3"
                    onFile={setExtra3}
                    file={extra3}
                    error={errors.extra3}
                  />
                )}
              </div>

              {/* Section 2: Consent */}
              <div className="space-y-4 p-6 sm:p-8">
                <h2 className="font-semibold text-[#0B1B2B]">Landlord Consent</h2>

                {[
                  {
                    key: "consent1",
                    checked: consent1,
                    onChange: setConsent1,
                    label: "I confirm I am the property owner or an authorised agent acting on their behalf.",
                  },
                  {
                    key: "consent2",
                    checked: consent2,
                    onChange: setConsent2,
                    label: "I consent to Lodgist verifying this information with relevant authorities and contacting the property owner.",
                  },
                ].map(({ key, checked, onChange, label }) => (
                  <div key={key} className="space-y-1">
                    <label className="flex cursor-pointer items-start gap-3">
                      <div className="relative mt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => onChange(e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded border-2 transition",
                            checked ? "border-[#1ABC9C] bg-[#1ABC9C]" : "border-gray-300 bg-white",
                          )}
                        >
                          {checked && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-gray-700 leading-relaxed">{label}</span>
                    </label>
                    {errors[key] && (
                      <p className="ml-8 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="h-3.5 w-3.5" /> {errors[key]}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Section 3: Notes */}
              <div className="space-y-3 p-6 sm:p-8">
                <h2 className="font-semibold text-[#0B1B2B]">Notes (Optional)</h2>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Add any context that might help our review team..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full resize-none rounded-lg border px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]"
                />
                <p className="text-right text-xs text-gray-400">{notes.length}/500</p>
              </div>

              {/* Submit */}
              <div className="space-y-4 p-6 sm:p-8">
                {serverError && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    {serverError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#FF6F3C] text-white hover:bg-[#e85d2c] py-3 text-base font-semibold"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
                  ) : (
                    <><Shield className="h-4 w-4 mr-2" />Submit for Verification</>
                  )}
                </Button>
                <p className="text-center text-xs text-gray-400">
                  Your documents are stored securely and only reviewed by our trust team.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
