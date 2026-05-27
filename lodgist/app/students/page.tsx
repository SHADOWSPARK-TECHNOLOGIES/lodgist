"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Shield, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { IMO_STATE_SCHOOLS, demandBadgeClass, type School } from "@/lib/data/imoStateSchools";
import { TruthIndexMeter } from "@/components/trust/TruthIndexMeter";

// ─── School Card ─────────────────────────────────────────────────────────────

function SchoolCard({ school }: { school: School }) {
  const router = useRouter();
  const demandLabel = school.housingDemand.charAt(0).toUpperCase() + school.housingDemand.slice(1);
  return (
    <button
      onClick={() => router.push(`/students/listings?school=${school.id}`)}
      className="group w-full rounded-xl border bg-white p-5 text-left transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-[#0B1B2B] leading-snug">{school.name}</h3>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", demandBadgeClass(school.housingDemand))}>
          {demandLabel}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{school.location}</p>
      <p className="mt-2 text-xs text-gray-400 line-clamp-2">{school.description}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-gray-500">~{school.studentPopulation.toLocaleString()} students</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-[#1ABC9C] group-hover:underline">
          View Lodges <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

// ─── Fraud Card ──────────────────────────────────────────────────────────────

function FraudCard({ icon, stat, title, body }: { icon: string; stat: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-white p-6 space-y-3">
      <div className="text-3xl">{icon}</div>
      <p className="text-sm font-bold text-[#FF6F3C]">{stat}</p>
      <h3 className="font-bold text-[#0B1B2B]">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
    </div>
  );
}

// ─── Trust Step ──────────────────────────────────────────────────────────────

const TRUST_STEPS = [
  { icon: "🏠", label: "Title Document Verified", pts: 30, desc: "We confirm the landlord actually owns the property." },
  { icon: "👤", label: "Landlord Identity Confirmed", pts: 25, desc: "We verify the person renting to you is who they claim to be." },
  { icon: "🚶", label: "Physical Inspection Done", pts: 20, desc: "Our agent visits the property in person before it is listed." },
  { icon: "💰", label: "Price Market Check", pts: 10, desc: "We flag listings priced far outside the local market rate." },
  { icon: "⚖️", label: "No Active Disputes", pts: 10, desc: "We check for existing complaints or fraud signals on the property." },
  { icon: "📄", label: "Legal Consent on File", pts: 5, desc: "The landlord signs a consent agreement with Lodgist." },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0B1B2B" />
              <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
              <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
            </svg>
            <span className="text-xl font-bold text-[#0B1B2B]">Lodgist</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/search" className="hover:text-[#0B1B2B] transition-colors">Properties</Link>
            <Link href="/students" className="text-[#FF6F3C]">Students</Link>
            <Link href="/verify" className="hover:text-[#0B1B2B] transition-colors">Verify</Link>
          </nav>
          <Link href="/register" className="rounded-lg bg-[#FF6F3C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e85d2c]">
            List Free
          </Link>
        </div>
      </header>

      {/* ── Section 1: Hero ──────────────────────────────────────────────── */}
      <section className="bg-[#0B1B2B] px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <span className="inline-block rounded-full bg-[#FF6F3C]/20 px-4 py-1 text-xs font-semibold text-[#FF6F3C] uppercase tracking-widest">
            Student Housing — Imo State
          </span>
          <h1 className="text-4xl font-bold text-white sm:text-5xl leading-tight">
            Find Your Lodge.<br />Safely.
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            Verified student housing near your school in Imo State.
            No fake agents. No stolen deposits. Just honest landlords.
          </p>

          {/* Quick school chips */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {["nekede", "futo", "imsu", "alvan", "imopoly"].map((id) => {
              const school = IMO_STATE_SCHOOLS.find((s) => s.id === id);
              if (!school) return null;
              return (
                <button
                  key={id}
                  onClick={() => router.push(`/students/listings?school=${id}`)}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm text-white transition hover:bg-white/20"
                >
                  {school.shortName}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => router.push("/students/listings")}
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF6F3C] px-8 py-3 font-semibold text-white hover:bg-[#e85d2c] transition"
          >
            Find Verified Housing <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* ── Section 2: Fraud Problem ─────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 space-y-3">
            <h2 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">
              Every Year, Students Lose Millions to Housing Scams
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto">
              Fake agents. Ghost landlords. Stolen deposits. It happens at every school in Imo State
              — and it has gone on for too long.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <FraudCard
              icon="👻"
              stat="1 in 4 student renters"
              title="Fall Victim to Fake Agents"
              body="Someone shows you a room, collects your ₦80,000 deposit, and disappears. You arrive to find someone else already living there. Your money is gone."
            />
            <FraudCard
              icon="🔑"
              stat="Same room, 6 different students"
              title="One Room Rented to Many"
              body="Unverified landlords collect caution fees from multiple students for the same room. First to arrive wins. Everyone else loses. No receipts. No recourse."
            />
            <FraudCard
              icon="📸"
              stat="Photos lie. Lodgist doesn't."
              title="The Room Was Never Real"
              body="Beautiful photos online. Broken-down room on arrival. You already paid. The landlord says 'take it or leave it.' With no verification, you have no power."
            />
          </div>
          {/* CTA strip */}
          <div className="mt-8 rounded-xl bg-[#FF6F3C] px-6 py-5 text-center text-white">
            <p className="font-semibold">
              Lodgist verifies every listing before it goes live. Your deposit is protected. Your move is safe.
            </p>
            <button
              onClick={() => router.push("/students/listings")}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-2 text-sm font-bold text-[#FF6F3C] hover:bg-orange-50 transition"
            >
              Find Verified Housing <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 3: Trust Layer ───────────────────────────────────────── */}
      <section className="bg-gray-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">The Lodgist Trust Layer</h2>
            <p className="text-gray-500">Every student listing passes a 6-point verification checklist.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRUST_STEPS.map((step) => (
              <div key={step.label} className="rounded-xl bg-white border p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xl">{step.icon}</span>
                  <span className="text-xs font-bold text-[#1ABC9C] bg-[#1ABC9C]/10 rounded-full px-2 py-0.5">
                    {step.pts} pts
                  </span>
                </div>
                <p className="font-semibold text-sm text-[#0B1B2B]">{step.label}</p>
                <p className="text-xs text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Sample meter */}
          <div className="mt-8 rounded-xl bg-white border p-6 space-y-3">
            <p className="text-sm text-gray-500 text-center">Sample listing with Truth Index 92</p>
            <TruthIndexMeter score={92} size="lg" />
            <p className="text-center text-xs text-gray-400">
              A listing scoring above 70 is considered safe to proceed.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 4: Browse By School ─────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 space-y-2">
            <h2 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">Find Housing Near Your School</h2>
            <p className="text-gray-500">Select your institution to see verified lodges nearby.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {IMO_STATE_SCHOOLS.map((school) => (
              <SchoolCard key={school.id} school={school} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: Student Pledge ────────────────────────────────────── */}
      <section className="bg-[#0B1B2B] px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Shield className="mx-auto h-10 w-10 text-[#1ABC9C]" />
          <h2 className="text-2xl font-bold text-white sm:text-3xl">The Lodgist Student Pledge</h2>
          <p className="text-gray-300 leading-relaxed">
            If a verified listing on Lodgist is proven fraudulent after you pay, we will work directly
            with you to recover your deposit or find alternative verified housing. We stand behind every
            listing we verify.
          </p>
          <p className="text-xs text-gray-500">
            This pledge applies to all listings with a Truth Index of 70 or above.
          </p>
          <Link
            href="/verify"
            className="inline-block rounded-lg border border-white/30 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition"
          >
            Read Full Terms
          </Link>
        </div>
      </section>

      {/* ── Section 6: For Landlords ─────────────────────────────────────── */}
      <section className="px-4 py-16 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl space-y-4">
          <CheckCircle className="mx-auto h-10 w-10 text-[#1ABC9C]" />
          <h2 className="text-2xl font-bold text-[#0B1B2B]">Are You a Landlord Near a Campus?</h2>
          <p className="text-gray-500 leading-relaxed">
            List your student lodge on Lodgist and get verified. Verified listings get 3× more enquiries
            than unverified ones. Free to list. Free to verify. You earn trust. Students pay safely.
          </p>
          <Link
            href="/dashboard/landlord/new-listing"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1ABC9C] px-8 py-3 font-semibold text-white hover:bg-[#15a082] transition"
          >
            List Your Lodge Free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
