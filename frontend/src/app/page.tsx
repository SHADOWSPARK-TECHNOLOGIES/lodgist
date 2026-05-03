"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

/**
 * TrustMeter component — fetches a user's Truth Index score from the backend
 * and displays a verification badge when the score exceeds 70.
 */
function TrustMeter({ userId }: { userId: number }) {
  const [trustData, setTrustData] = useState<{
    trustScore: number;
    verified: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`http://localhost:4000/api/verification/${userId}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch trust data");
        return res.json();
      })
      .then((data) => {
        setTrustData({ trustScore: data.trustScore, verified: data.verified });
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-light-gray">
        <div className="h-4 w-4 animate-pulse rounded-full bg-teal/50" />
        Loading trust score…
      </div>
    );
  }

  if (error || !trustData) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Trust Score Bar */}
      <div className="flex items-center gap-1.5">
        <span className="text-light-gray">Trust Score:</span>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-deep-navy/30">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${trustData.trustScore}%`,
              backgroundColor: "#1ABC9C",
            }}
          />
        </div>
        <span className="font-semibold text-teal">{trustData.trustScore}</span>
      </div>

      {/* Verified Badge */}
      {trustData.verified && (
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-teal/15 px-3 py-0.5 text-xs font-semibold text-teal">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          Verified
        </span>
      )}
    </div>
  );
}

export default function Home() {
  // Example user ID — in a real app this would come from auth context or route params
  const demoUserId = 1;

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-deep-navy px-6 sm:px-12 lg:px-24">
      {/* Empathy-Driven Onboarding Hero Section */}
      <section className="flex w-full max-w-5xl flex-col items-center text-center">
        {/* Headline */}
        <h1 className="font-heading text-3xl font-bold leading-tight text-off-white sm:text-4xl md:text-5xl lg:text-6xl">
          Finding a new home can be stressful —{" "}
          <span className="text-teal">we're here to make it easier.</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-light-gray sm:text-lg md:text-xl">
          Whether you're relocating, upsizing, or starting fresh, Lodgist
          connects you with spaces that truly feel like home.
        </p>

        {/* Trust Meter — Truth Index badge */}
        <div className="mt-6">
          <TrustMeter userId={demoUserId} />
        </div>

        {/* Primary CTA Button */}
        <Link
          href="/search"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-vibrant-orange px-8 py-4 font-heading text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-orange-600 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-vibrant-orange focus:ring-offset-2 focus:ring-offset-deep-navy sm:text-lg"
        >
          Start Your Search
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>

        {/* Trust indicators */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-light-gray">
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-teal"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            Verified Listings
          </span>
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-teal"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Personal Support
          </span>
          <span className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-teal"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Fast & Easy Process
          </span>
        </div>
      </section>
    </main>
  );
}
