"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Search, ChevronDown, Star, Shield, Zap, MapPin, TrendingUp, ArrowRight, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PropertyCard from "@/components/PropertyCard";
import { getAllStateNames } from "@/lib/data/nigerianLgas";
import type { Listing } from "@/components/PropertyCard";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_LISTINGS: Listing[] = [
  {
    id: "1",
    title: "Modern 3-Bedroom Apartment in Lekki Phase 1",
    price: 4500000,
    location: { address: "12 Admiralty Way", lga: "Eti Osa", state: "Lagos" },
    propertyType: "apartment",
    bedrooms: 3,
    bathrooms: 2,
    amenities: ["Parking", "Generator", "Security"],
    truthIndex: 92,
    owner: { name: "Chidi Okonkwo", verified: true },
  },
  {
    id: "2",
    title: "Spacious 4-Bedroom Duplex in Wuse 2",
    price: 8500000,
    location: { address: "45 Aminu Kano Crescent", lga: "Municipal Area Council", state: "FCT" },
    propertyType: "house",
    bedrooms: 4,
    bathrooms: 3,
    amenities: ["Pool", "Garden", "Parking", "CCTV"],
    truthIndex: 88,
    owner: { name: "Fatima Bello", verified: true },
  },
  {
    id: "3",
    title: "Prime Commercial Plot in Victoria Island",
    price: 25000000,
    location: { address: "Plot 7, Bishop Oluwole Street", lga: "Eti Osa", state: "Lagos" },
    propertyType: "land",
    truthIndex: 76,
    owner: { name: "Lekki Properties Ltd", verified: true },
  },
  {
    id: "4",
    title: "2-Bedroom Flat in GRA Phase 2, Port Harcourt",
    price: 3200000,
    location: { address: "8 Woji Road", lga: "Obio/Akpor", state: "Rivers" },
    propertyType: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    amenities: ["Parking", "Generator"],
    truthIndex: 85,
    owner: { name: "Ngozi Eze", verified: true },
  },
  {
    id: "5",
    title: "Luxury 5-Bedroom Villa in Ikoyi",
    price: 18000000,
    location: { address: "22 Bourdillon Road", lga: "Eti Osa", state: "Lagos" },
    propertyType: "house",
    bedrooms: 5,
    bathrooms: 4,
    amenities: ["Pool", "Garden", "Smart Home", "CCTV", "Staff Quarters"],
    truthIndex: 95,
    owner: { name: "Tunde Balogun", verified: true },
  },
  {
    id: "6",
    title: "Commercial Shop in Abuja City Centre",
    price: 6200000,
    location: { address: "30 Ibrahim Taiwo Road", lga: "Municipal Area Council", state: "FCT" },
    propertyType: "commercial",
    truthIndex: 71,
    owner: { name: "Aso Properties", verified: false },
  },
];

const PROPERTY_TYPES = ["Apartment", "House", "Land", "Commercial"];

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="shrink-0">
            <rect width="36" height="36" rx="8" fill="#0B1B2B" />
            <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
            <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
          </svg>
          <span className={cn(
            "text-xl font-bold tracking-tight transition-colors",
            scrolled ? "text-[#0B1B2B]" : "text-white",
          )}>
            Lodgist
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {["Properties", "How It Works", "About"].map((link) => (
            <Link
              key={link}
              href="#"
              className={cn(
                "text-sm font-medium transition-colors hover:text-[#FF6F3C]",
                scrolled ? "text-[#0B1B2B]" : "text-white/90",
              )}
            >
              {link}
            </Link>
          ))}
        </nav>

        {/* Desktop Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Button
            variant="ghost"
            className={cn(
              "text-sm font-medium",
              scrolled ? "text-[#0B1B2B]" : "text-white/90 hover:text-white hover:bg-white/10",
            )}
          >
            List Property
          </Button>
          <Button className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c] text-sm font-semibold px-5">
            Sign In
          </Button>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "md:hidden transition-colors",
            scrolled ? "text-[#0B1B2B]" : "text-white",
          )}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="border-t bg-white px-4 pb-5 pt-3 md:hidden">
          <nav className="flex flex-col gap-3">
            {["Properties", "How It Works", "About"].map((link) => (
              <Link
                key={link}
                href="#"
                className="text-sm font-medium text-[#0B1B2B] hover:text-[#FF6F3C]"
                onClick={() => setMenuOpen(false)}
              >
                {link}
              </Link>
            ))}
            <hr className="my-2" />
            <Button variant="ghost" className="justify-start text-sm text-[#0B1B2B]">
              List Property
            </Button>
            <Button className="bg-[#FF6F3C] text-white hover:bg-[#e85d2c] text-sm font-semibold w-full">
              Sign In
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}

// ─── Hero Section ────────────────────────────────────────────────────────────

function HeroSection() {
  const states = getAllStateNames();
  const [selectedState, setSelectedState] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-[#0B1B2B] px-4 pt-20 pb-16 sm:px-6 lg:px-8">
      {/* Orange glow */}
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#FF6F3C]/10 blur-[120px]" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full bg-[#1ABC9C]/5 blur-[100px]" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm">
          <Shield className="h-3.5 w-3.5 text-[#1ABC9C]" />
          Nigeria's First Fraud-Proof Property Marketplace
        </div>

        {/* Headline */}
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
          Find Verified Properties in{" "}
          <span className="text-[#FF6F3C]">Nigeria</span>
        </h1>

        {/* Subheadline */}
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
          Zero fraud. No middlemen. Every listing has a{" "}
          <span className="font-semibold text-[#1ABC9C]">Truth Index</span> score
          so you know exactly what you're getting.
        </p>

        {/* Search Bar */}
        <div className="mt-8 flex w-full max-w-2xl flex-col gap-3 sm:flex-row">
          {/* State Dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => { setStateOpen(!stateOpen); setTypeOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm text-[#0B1B2B] shadow-sm transition-colors hover:bg-gray-50"
            >
              <span className={selectedState ? "font-medium" : "text-gray-400"}>
                {selectedState || "Select State"}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", stateOpen && "rotate-180")} />
            </button>
            {stateOpen && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {states.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setSelectedState(s); setStateOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1ABC9C]/10",
                      selectedState === s && "bg-[#1ABC9C]/10 font-medium text-[#1ABC9C]",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Property Type Dropdown */}
          <div className="relative flex-1">
            <button
              onClick={() => { setTypeOpen(!typeOpen); setStateOpen(false); }}
              className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm text-[#0B1B2B] shadow-sm transition-colors hover:bg-gray-50"
            >
              <span className={selectedType ? "font-medium" : "text-gray-400"}>
                {selectedType || "Property Type"}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform", typeOpen && "rotate-180")} />
            </button>
            {typeOpen && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSelectedType(t); setTypeOpen(false); }}
                    className={cn(
                      "w-full px-4 py-2 text-left text-sm transition-colors hover:bg-[#1ABC9C]/10",
                      selectedType === t && "bg-[#1ABC9C]/10 font-medium text-[#1ABC9C]",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button className="flex items-center gap-2 bg-[#FF6F3C] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#e85d2c] sm:w-auto">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {[
            { icon: Shield, label: "Verified Listings", color: "text-[#1ABC9C]" },
            { icon: Zap, label: "Instant Booking", color: "text-[#FF6F3C]" },
            { icon: TrendingUp, label: "Escrow Protected", color: "text-[#1ABC9C]" },
          ].map((badge) => (
            <div key={badge.label} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <badge.icon className={cn("h-4 w-4", badge.color)} />
              <span className="text-xs font-medium text-white/80">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Featured Listings ───────────────────────────────────────────────────────

function FeaturedListings() {
  return (
    <section className="bg-gray-50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <h2 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">
              Verified Properties Near You
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Every listing verified by our Truth Index Algorithm
            </p>
          </div>
          <Link
            href="#"
            className="flex items-center gap-1.5 text-sm font-semibold text-[#1ABC9C] transition-colors hover:text-[#15a082]"
          >
            View All Properties
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_LISTINGS.map((listing) => (
            <PropertyCard key={listing.id} listing={listing} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button className="bg-[#1ABC9C] px-8 py-3 text-sm font-semibold text-white hover:bg-[#15a082]">
            View All Properties
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "Search & Discover",
      description: "Browse verified listings with Truth Index scores. Filter by state, type, and budget.",
      color: "bg-[#FF6F3C]/10 text-[#FF6F3C]",
    },
    {
      icon: Home,
      title: "Book a Viewing",
      description: "Schedule directly with the landlord. No agent fees, no middlemen.",
      color: "bg-[#1ABC9C]/10 text-[#1ABC9C]",
    },
    {
      icon: Shield,
      title: "Pay Safely",
      description: "Funds held in escrow until you move in. Your money is protected.",
      color: "bg-[#FF6F3C]/10 text-[#FF6F3C]",
    },
  ];

  return (
    <section className="bg-[#0B1B2B] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl text-center">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          How It Works
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Three simple steps to your next home
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              {/* Step Number */}
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
                0{i + 1}
              </div>
              {/* Icon */}
              <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl", step.color)}>
                <step.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/60">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Truth Index Explainer ───────────────────────────────────────────────────

function TruthIndexExplainer() {
  const [count, setCount] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const target = 85;
          const duration = 1500;
          const start = performance.now();

          function animate(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          }
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const bars = [
    { label: "Images", score: 20, max: 20, color: "bg-[#1ABC9C]" },
    { label: "Description", score: 15, max: 15, color: "bg-[#1ABC9C]" },
    { label: "Verified Owner", score: 25, max: 25, color: "bg-[#1ABC9C]" },
    { label: "Price Fairness", score: 15, max: 20, color: "bg-[#FF6F3C]" },
    { label: "Reviews", score: 10, max: 20, color: "bg-[#FF6F3C]" },
  ];

  return (
    <section ref={sectionRef} className="bg-white px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: Explanation */}
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1ABC9C]/10 px-4 py-1.5 text-xs font-semibold text-[#1ABC9C]">
              <Star className="h-3.5 w-3.5" />
              Truth Index™
            </div>
            <h2 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">
              What is the Truth Index?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-600">
              Every property on Lodgist is scored by our AI-powered Truth Index
              Algorithm. It analyzes listing images, descriptions, owner
              verification, pricing fairness, and community reviews to give you
              a single, trustworthy score out of 100.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              A score of 80+ means the listing is highly trustworthy. Below 50?
              We flag it for review. No more guessing if a listing is real.
            </p>
            <Link
              href="#"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1ABC9C] transition-colors hover:text-[#15a082]"
            >
              Learn how the algorithm works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Right: Score Card */}
          <Card className="border border-gray-100 shadow-lg">
            <CardContent className="p-6 sm:p-8">
              {/* Big Score */}
              <div className="mb-6 text-center">
                <div className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-[#1ABC9C]/10">
                  <span className="text-3xl font-bold text-[#1ABC9C]">{count}</span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-500">Truth Index Score</p>
              </div>

              {/* Score Bars */}
              <div className="space-y-4">
                {bars.map((bar) => (
                  <div key={bar.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{bar.label}</span>
                      <span className="text-gray-400">
                        {bar.score}/{bar.max}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn("h-full rounded-full transition-all duration-1000 ease-out", bar.color)}
                        style={{ width: `${(bar.score / bar.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
                <span className="font-semibold text-[#0B1B2B]">Total Score</span>
                <span className="font-bold text-[#1ABC9C]">85/100</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}

// ─── Trust Stats Banner ──────────────────────────────────────────────────────

function TrustStatsBanner() {
  const stats = [
    { value: "2,400+", label: "Listings" },
    { value: "36", label: "States" },
    { value: "98%", label: "Fraud-Free" },
    { value: "₦0", label: "Agent Fees" },
  ];

  return (
    <section className="bg-[#FF6F3C] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-white sm:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-white/80">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const footerLinks = [
    { label: "Properties", href: "#" },
    { label: "Landlords", href: "#" },
    { label: "Agents", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ];

  return (
    <footer className="bg-[#0B1B2B] px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center gap-8 text-center md:flex-row md:items-start md:justify-between md:text-left">
          {/* Logo + Tagline */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center justify-center gap-2 md:justify-start">
              <svg width="32" height="32" viewBox="0 0 36 36" fill="none" className="shrink-0">
                <rect width="36" height="36" rx="8" fill="#FF6F3C" />
                <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#0B1B2B" />
                <rect x="14" y="20" width="8" height="6" fill="white" rx="1" />
              </svg>
              <span className="text-xl font-bold text-white">Lodgist</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              Nigeria's fraud-proof property marketplace. Every listing verified, every transaction protected.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 md:justify-start">
            {footerLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* WhatsApp CTA */}
          <div>
            <Button className="flex items-center gap-2 bg-[#25D366] px-5 py-3 text-sm font-semibold text-white hover:bg-[#20bd5a]">
              <MessageCircle className="h-4 w-4" />
              Chat with us on WhatsApp
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

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturedListings />
        <HowItWorks />
        <TruthIndexExplainer />
        <TrustStatsBanner />
      </main>
      <Footer />
    </div>
  );
}
