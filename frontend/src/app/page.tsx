"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useState, useEffect } from "react";
import TrustBadge from "@/components/TrustBadge";
import AuditResultCard from "@/components/AuditResultCard";
import MilestonePayment from "@/components/MilestonePayment";
import MoveInCostLedger from "@/components/MoveInCostLedger";
import NeighborhoodIntelligence from "@/components/NeighborhoodIntelligence";
import PaymentStatusCard from "@/components/PaymentStatusCard";
import { FeeLedger, NeighborhoodGrid } from "@/components/ListingDetail";

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

    apiFetch(`/api/verification/${userId}`, {
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

  // Demo data for components
  const demoMoveInCostMeta = {
    base_rent: 1_500_000,
    agency_fee: 150_000,
    legal_fee: 75_000,
    caution_fee: 150_000,
    total: 1_875_000,
    currency: "NGN",
    payment_structure: "Annual payment required upfront",
  };

  const demoNeighborhoodData = {
    name: "GRA Phase 2",
    city: "Port Harcourt",
    state: "Rivers",
    safety_rating: 82,
    flood_risk: "low" as const,
    description:
      "One of the most sought-after residential areas in Port Harcourt, known for its planned layout, security, and proximity to key amenities.",
    amenities: [
      { type: "school", name: "Springfield International School", distance: "0.8 km", rating: 4.5 },
      { type: "hospital", name: "Braithwaite Memorial Hospital", distance: "2.1 km", rating: 4.2 },
      { type: "shopping", name: "ShopRite PH", distance: "1.5 km", rating: 4.3 },
      { type: "transit", name: "PH City Bus Terminal", distance: "3.0 km" },
      { type: "security", name: "Police Post GRA", distance: "0.5 km" },
      { type: "restaurant", name: "Barcelona Restaurant", distance: "0.6 km", rating: 4.6 },
    ],
  };

  const demoMilestones = [
    {
      id: "ms-1",
      label: "Booking Deposit",
      amount: 500_000,
      currency: "NGN",
      due_date: "2026-05-15",
      status: "completed" as const,
      completed_at: "2026-05-10",
    },
    {
      id: "ms-2",
      label: "First Month Rent",
      amount: 125_000,
      currency: "NGN",
      due_date: "2026-06-01",
      status: "pending" as const,
    },
    {
      id: "ms-3",
      label: "Agency Fee",
      amount: 150_000,
      currency: "NGN",
      due_date: "2026-05-15",
      status: "pending" as const,
    },
  ];

  const demoCostItems = [
    { label: "Base Rent", key: "base_rent", amount: 1_500_000, icon: "home" as const, required: true },
    { label: "Agency Fee", key: "agency_fee", amount: 150_000, icon: "search" as const, required: true },
    { label: "Legal Fee", key: "legal_fee", amount: 75_000, icon: "file" as const, required: true },
    { label: "Caution Fee", key: "caution_fee", amount: 150_000, icon: "shield" as const, required: true },
  ];

  const demoNeighborhoodStats = {
    name: "GRA Phase 2",
    avg_rent: 1_500_000,
    currency: "NGN",
    occupancy_rate: 94,
    population_density: "Medium",
    growth_trend: "rising" as const,
    safety_index: 82,
    flood_risk: "low" as const,
    amenities_count: 24,
    description:
      "GRA Phase 2 is a premier residential district with excellent infrastructure, 24/7 security patrols, and easy access to commercial hubs.",
  };

  const demoPayments = [
    {
      id: "pay-1",
      reference: "TXN-2026-001",
      amount: 500_000,
      currency: "NGN",
      status: "completed" as const,
      description: "Booking Deposit",
      created_at: "2026-05-10",
      completed_at: "2026-05-10",
      method: "Bank Transfer",
    },
    {
      id: "pay-2",
      reference: "TXN-2026-002",
      amount: 1_375_000,
      currency: "NGN",
      status: "pending" as const,
      description: "Balance Payment",
      created_at: "2026-05-10",
      method: "Bank Transfer",
    },
  ];

  return (
    <div className="flex flex-col flex-1 items-center bg-deep-navy font-sans">
      {/* Hero Section */}
      <main className="flex w-full max-w-5xl flex-col items-center px-6 py-32 sm:px-12 lg:px-24">
        {/* Empathy-Driven Onboarding Hero Section */}
        <section className="flex w-full flex-col items-center text-center">
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

          {/* Trust Badge — enhanced version */}
          <div className="mt-4">
            <TrustBadge userId={demoUserId} />
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

        {/* ─── Demo Components Section ─── */}
        <section className="mt-32 w-full">
          <h2 className="mb-8 text-center font-heading text-2xl font-bold text-off-white">
            Platform Features
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Fee Ledger */}
            <FeeLedger
              metadata={demoMoveInCostMeta}
              category="residential"
            />

            {/* Neighborhood Grid */}
            <NeighborhoodGrid data={demoNeighborhoodData} />

            {/* Move-In Cost Ledger */}
            <MoveInCostLedger
              costs={demoCostItems}
              total={1_875_000}
              currency="NGN"
              notes="All fees are payable upon signing the tenancy agreement."
            />

            {/* Neighborhood Intelligence */}
            <NeighborhoodIntelligence data={demoNeighborhoodStats} />

            {/* Milestone Payments */}
            <MilestonePayment milestones={demoMilestones} />

            {/* Payment Status */}
            <PaymentStatusCard payments={demoPayments} />

            {/* Audit Result Card */}
            <div className="md:col-span-2">
              <AuditResultCard listingId="demo-001" />
            </div>
          </div>
        </section>

        {/* ─── Bottom CTA ─── */}
        <section className="mt-32 mb-16 text-center">
          <h2 className="font-heading text-2xl font-bold text-off-white sm:text-3xl">
            Ready to find your next home?
          </h2>
          <p className="mt-4 text-light-gray">
            Join thousands of tenants and landlords already using Lodgist.
          </p>
          <Link
            href="/search"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-teal px-8 py-4 font-heading text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-teal/80 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal focus:ring-offset-2 focus:ring-offset-deep-navy sm:text-lg"
          >
            Get Started
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
        </section>
      </main>
    </div>
  );
}
