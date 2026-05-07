"use client";

import { Star, User, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReviewUser {
  name: string;
  image: string | null;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: ReviewUser;
}

interface ReviewsSectionProps {
  reviews: ReviewItem[];
  averageRating: number;
  totalReviews: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const starSize = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            starSize,
            star <= rating
              ? "fill-[#FF6F3C] text-[#FF6F3C]"
              : "fill-gray-200 text-gray-200",
          )}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReviewsSection({
  reviews,
  averageRating,
  totalReviews,
}: ReviewsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#0B1B2B]">
          <MessageSquare className="h-5 w-5 text-[#1ABC9C]" />
          Reviews
          {totalReviews > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({totalReviews})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Average rating summary */}
        {totalReviews > 0 && (
          <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-[#0B1B2B]">
                {averageRating.toFixed(1)}
              </p>
              <StarRating rating={Math.round(averageRating)} size="md" />
              <p className="mt-1 text-xs text-muted-foreground">
                {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>
            {/* Rating distribution bars */}
            <div className="flex-1 space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter((r) => r.rating === star).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-3 text-right text-muted-foreground">{star}</span>
                    <Star className="h-3 w-3 fill-[#FF6F3C] text-[#FF6F3C]" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-[#FF6F3C] transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalReviews === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No reviews yet. Be the first to review this property!
            </p>
          </div>
        )}

        {/* Review list */}
        {reviews.length > 0 && (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1ABC9C]/10 text-[#1ABC9C]">
                      {review.user.image ? (
                        <img
                          src={review.user.image}
                          alt={review.user.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#0B1B2B]">
                        {review.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(review.createdAt))}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
