// Previous marketing homepage backed up to app/_page-marketing.tsx.bak
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, MessageCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/dashboard/SearchBar";
import SearchResults from "@/components/dashboard/SearchResults";
import { IMO_STATE_SCHOOLS } from "@/lib/data/imoStateSchools";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormattedListing {
  id: number;
  title: string;
  price: number;
  address?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  propertyType?: string | null;
  amenities?: string[];
  nearbySchool?: string | null;
  distanceToSchool?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  isVerified: boolean;
  feeBreakdown: {
    rent: number;
    agentFee: number;
    agreementFee: number;
    inspectionFee: number;
    total: number;
    lodgistSaving: number;
  } | null;
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            fill="none"
            className="shrink-0"
          >
            <rect width="36" height="36" rx="8" fill="#0B1B2B" />
            <path
              d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z"
              fill="#FF6F3C"
            />
            <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
          </svg>
          <span
            className={cn(
              "text-xl font-bold tracking-tight transition-colors",
              scrolled ? "text-[#0B1B2B]" : "text-white"
            )}
          >
            Lodgist
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {[
            { label: "Properties", href: "/search" },
            { label: "Students", href: "/students" },
            { label: "How It Works", href: "#how-it-works" },
          ].map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-[#FF6F3C]",
                scrolled ? "text-[#0B1B2B]" : "text-white/90"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/register">
            <Button
              variant="ghost"
              className={cn(
                "text-sm font-medium",
                scrolled
                  ? "text-[#0B1B2B]"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              )}
            >
              List Property
            </Button>
          </Link>
          <Link href="/login">
            <Button className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c] text-sm font-semibold px-5">
              Sign In
            </Button>
          </Link>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "md:hidden transition-colors",
            scrolled ? "text-[#0B1B2B]" : "text-white"
          )}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t bg-white px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-3">
            {[
              { label: "Properties", href: "/search" },
              { label: "Students", href: "/students" },
              { label: "How It Works", href: "#how-it-works" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-[#0B1B2B] hover:text-[#FF6F3C]"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <hr className="my-2" />
            <Link href="/register" onClick={() => setMenuOpen(false)}>
              <Button
                variant="ghost"
                className="justify-start text-sm text-[#0B1B2B] w-full"
              >
                List Property
              </Button>
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)}>
              <Button className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c] text-sm font-semibold w-full">
                Sign In
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-[#0B1B2B] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="max-w-xs">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 md:justify-start"
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 36 36"
                fill="none"
                className="shrink-0"
              >
                <rect width="36" height="36" rx="8" fill="#FF6F3C" />
                <path
                  d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z"
                  fill="#0B1B2B"
                />
                <rect x="14" y="20" width="8" height="6" fill="white" rx="1" />
              </svg>
              <span className="text-xl font-bold text-white">Lodgist</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              Nigeria&apos;s verified student housing platform. Direct to
              landlord. No agent fees.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 md:justify-start">
            {[
              { label: "Properties", href: "/search" },
              { label: "Students", href: "/students" },
              { label: "Landlords", href: "/register" },
              { label: "Privacy", href: "#" },
              { label: "Terms", href: "#" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div>
            <Button className="flex items-center gap-2 bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:bg-[#20bd5a]">
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </Button>
          </div>
        </div>

        <hr className="my-8 border-white/10" />
        <p className="text-center text-xs text-white/40">
          &copy; 2026 Lodgist Technologies. Built in Nigeria 🇳🇬
        </p>
      </div>
    </footer>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{
    verified: FormattedListing[];
    scraped: FormattedListing[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleSearch(q: string) {
    setQuery(q);
    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as {
        verified?: FormattedListing[];
        scraped?: FormattedListing[];
      };
      setResults({
        verified: data.verified ?? [],
        scraped: data.scraped ?? [],
      });
    } catch {
      setResults({ verified: [], scraped: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar scrolled={scrolled || !!results} />

      <main className="flex-1 bg-gradient-to-b from-white via-gray-50 to-white">
        {/* ── Hero ── */}
        <section
          className={cn(
            "px-4 transition-all duration-500",
            results ? "pt-24 pb-6" : "pt-24 pb-14"
          )}
        >
          <div className="max-w-4xl mx-auto text-center">
            {!results && (
              <>
                <span className="inline-block bg-[#1ABC9C]/10 text-[#1ABC9C] text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4">
                  For Students Across Nigeria
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0B1B2B] leading-tight mb-4">
                  Find Your Lodge.
                  <br />
                  <span className="text-[#FF6F3C]">Skip the Agent.</span>
                </h1>
                <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                  Just type what you&apos;re looking for. Lodgist finds verified
                  lodges with no agent fees — and shows you exactly what agents
                  charge on other listings.
                </p>
              </>
            )}

            <SearchBar
              onSearch={handleSearch}
              loading={loading}
              initialQuery={query}
            />
          </div>
        </section>

        {/* ── Results or Browse ── */}
        <section className="max-w-7xl mx-auto px-4 pb-16">
          {results ? (
            <SearchResults
              verified={results.verified}
              scraped={results.scraped}
              query={query}
              loading={loading}
            />
          ) : (
            <>
              {/* Browse by school */}
              <div className="mt-8">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-[#0B1B2B] mb-2">
                    Or Browse By School
                  </h2>
                  <p className="text-sm text-gray-500">
                    Verified student lodges near every major institution
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {IMO_STATE_SCHOOLS.map((school) => (
                    <button
                      key={school.id}
                      onClick={() =>
                        handleSearch(`Lodges near ${school.shortName}`)
                      }
                      className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1ABC9C] hover:shadow-sm transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[#0B1B2B]/5 flex items-center justify-center mb-2">
                        <span className="text-base">🎓</span>
                      </div>
                      <div className="font-semibold text-[#0B1B2B] text-sm leading-tight">
                        {school.shortName}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        ~{(school.studentPopulation / 1000).toFixed(0)}k students
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Why Lodgist strip */}
              <div
                id="how-it-works"
                className="mt-16 bg-[#0B1B2B] rounded-3xl px-6 py-10 sm:px-12"
              >
                <div className="text-center mb-8">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    Why Lodgist
                  </h2>
                  <p className="text-gray-400 text-sm sm:text-base">
                    Three problems we solve for every Nigerian student
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/5 backdrop-blur rounded-2xl p-5">
                    <div className="w-10 h-10 rounded-xl bg-[#FF6F3C]/20 flex items-center justify-center mb-3 text-xl">
                      🛡️
                    </div>
                    <h3 className="font-bold text-white mb-1.5">
                      No Fake Agents
                    </h3>
                    <p className="text-sm text-gray-400">
                      Every verified landlord has their identity confirmed. The
                      person you pay is provably real.
                    </p>
                  </div>

                  <div className="bg-white/5 backdrop-blur rounded-2xl p-5">
                    <div className="w-10 h-10 rounded-xl bg-[#1ABC9C]/20 flex items-center justify-center mb-3 text-xl">
                      💸
                    </div>
                    <h3 className="font-bold text-white mb-1.5">
                      No Hidden Fees
                    </h3>
                    <p className="text-sm text-gray-400">
                      You pay the landlord directly. We expose what agents
                      charge on other listings so you can see exactly what you
                      save.
                    </p>
                  </div>

                  <div className="bg-white/5 backdrop-blur rounded-2xl p-5">
                    <div className="w-10 h-10 rounded-xl bg-[#FF6F3C]/20 flex items-center justify-center mb-3 text-xl">
                      🤖
                    </div>
                    <h3 className="font-bold text-white mb-1.5">
                      AI Does the Search
                    </h3>
                    <p className="text-sm text-gray-400">
                      Just describe what you need. Our AI understands Nigerian
                      locations, student budgets, and what really matters.
                    </p>
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-12 flex flex-wrap justify-center gap-4">
                {[
                  {
                    icon: Shield,
                    label: "Identity Verified Landlords",
                    color: "text-[#1ABC9C]",
                  },
                  {
                    icon: () => (
                      <span className="text-base font-bold text-[#FF6F3C]">
                        ₦0
                      </span>
                    ),
                    label: "Agent Fees on Verified Listings",
                    color: "text-[#FF6F3C]",
                  },
                  {
                    icon: () => <span className="text-base">🤖</span>,
                    label: "AI-Powered Search",
                    color: "text-[#1ABC9C]",
                  },
                ].map((badge) => (
                  <div
                    key={badge.label}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 shadow-sm"
                  >
                    <badge.icon
                      className={cn("h-4 w-4", badge.color)}
                    />
                    <span className="text-xs font-medium text-gray-700">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
