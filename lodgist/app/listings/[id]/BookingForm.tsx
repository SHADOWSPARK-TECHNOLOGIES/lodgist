"use client";

import { useState, FormEvent } from "react";
import { Calendar, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingFormProps {
  listingId: string;
  price: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNgn(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingForm({ listingId, price }: BookingFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!startDate || !endDate) {
      setFeedback({ type: "error", text: "Please select both start and end dates." });
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setFeedback({ type: "error", text: "End date must be after start date." });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, startDate, endDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data.message ?? "Failed to create booking. Please try again.",
        });
        return;
      }

      setFeedback({
        type: "success",
        text: "Viewing request submitted successfully! The landlord will be in touch.",
      });
      setStartDate("");
      setEndDate("");
      setMessage("");
    } catch {
      setFeedback({
        type: "error",
        text: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  // Minimum date = today
  const today = new Date().toISOString().split("T")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#0B1B2B]">
          <Calendar className="h-5 w-5 text-[#1ABC9C]" />
          Request Viewing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Price summary */}
          <div className="rounded-lg bg-[#FF6F3C]/5 p-3 text-center">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="text-xl font-bold text-[#FF6F3C]">
              {formatNgn(price)}
              <span className="text-sm font-normal text-muted-foreground">
                /yr
              </span>
            </p>
          </div>

          {/* Start date */}
          <div className="space-y-1.5">
            <label
              htmlFor="startDate"
              className="text-sm font-medium text-[#0B1B2B]"
            >
              Move-in Date
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={today}
              required
              className={cn(
                "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]",
              )}
            />
          </div>

          {/* End date */}
          <div className="space-y-1.5">
            <label
              htmlFor="endDate"
              className="text-sm font-medium text-[#0B1B2B]"
            >
              Move-out Date
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || today}
              required
              className={cn(
                "block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]",
              )}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <label
              htmlFor="message"
              className="text-sm font-medium text-[#0B1B2B]"
            >
              Message (optional)
            </label>
            <textarea
              id="message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi, I'm interested in this property. Please let me know when I can schedule a viewing."
              className={cn(
                "block w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground",
                "focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]",
              )}
            />
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#FF6F3C] text-white hover:bg-[#e85d2c]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Request Viewing
              </>
            )}
          </Button>

          {/* Feedback */}
          {feedback && (
            <div
              className={cn(
                "rounded-lg p-3 text-sm",
                feedback.type === "success"
                  ? "bg-[#1ABC9C]/10 text-[#1ABC9C]"
                  : "bg-red-50 text-red-600",
              )}
            >
              {feedback.text}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
