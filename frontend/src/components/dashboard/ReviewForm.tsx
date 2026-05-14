"use client";

// ─── ReviewForm ────────────────────────────────────────────────────────────
// Optimistic review submission form using React 19's useOptimistic hook.
// Allows users to submit and update reviews for listings.

import { useState, useOptimistic, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { reviewsApi } from "@/lib/api";
import type { Review, CreateReviewPayload, UpdateReviewPayload } from "@/lib/types";

interface ReviewFormProps {
  listingId: number;
  existingReview?: Review | null;
  onSuccess?: () => void;
}

interface OptimisticReview {
  id: number | "pending";
  listingId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
  optimistic: boolean;
}

export default function ReviewForm({ listingId, existingReview, onSuccess }: ReviewFormProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [hoveredRating, setHoveredRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic state using React 19's useOptimistic
  const [optimisticReview, addOptimisticReview] = useOptimistic<
    OptimisticReview | null,
    OptimisticReview
  >(null, (_state, newReview) => newReview);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
        setError("You must be logged in to submit a review");
        return;
      }

      setSubmitting(true);
      setError(null);

      // Optimistic update
      const optimistic: OptimisticReview = {
        id: "pending",
        listingId,
        userId: user.id,
        rating,
        comment: comment || null,
        createdAt: new Date().toISOString(),
        optimistic: true,
      };
      addOptimisticReview(optimistic);

      try {
        if (existingReview) {
          const payload: UpdateReviewPayload = { rating, comment: comment || undefined };
          const res = await reviewsApi.update(existingReview.id, payload);
          if (!res.success) throw new Error(res.error || "Failed to update review");
        } else {
          const payload: CreateReviewPayload = {
            listingId,
            rating,
            comment: comment || undefined,
          };
          const res = await reviewsApi.create(payload);
          if (!res.success) throw new Error(res.error || "Failed to submit review");
        }
        onSuccess?.();
        if (!existingReview) {
          setComment("");
          setRating(5);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to submit review");
      } finally {
        setSubmitting(false);
      }
    },
    [user, listingId, rating, comment, existingReview, onSuccess, addOptimisticReview]
  );

  if (!user) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-500">
        Please log in to submit a review.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Star Rating */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Rating
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="text-2xl transition hover:scale-110 focus:outline-none"
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              {(hoveredRating || rating) >= star ? "⭐" : "☆"}
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-500 self-center">
            {rating} / 5
          </span>
        </div>
      </div>

      {/* Comment */}
      <div>
        <label htmlFor="review-comment" className="block text-sm font-medium text-gray-700 mb-1">
          Comment{" "}
          <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience with this listing..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
          maxLength={1000}
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {comment.length}/1000
        </p>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {submitting
          ? "Submitting..."
          : existingReview
          ? "Update Review"
          : "Submit Review"}
      </button>

      {/* Optimistic indicator */}
      {optimisticReview?.optimistic && (
        <p className="text-xs text-blue-600 text-center animate-pulse">
          Submitting your review...
        </p>
      )}
    </form>
  );
}
