"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, X, ArrowLeft, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/PropertyCard";
import { IMO_STATE_SCHOOLS, getSchoolById } from "@/lib/data/imoStateSchools";
import { RiskStateBadge } from "@/components/trust/RiskStateBadge";
import type { Listing } from "@/components/PropertyCard";

// ─── Student listings (seeded data sourced from field research, Imo State) ───

const STUDENT_LISTINGS: Listing[] = [
  {
    id: "s1",
    title: "Self-Contain Room, 5 mins from Poly Nekede Gate",
    price: 120000,
    location: { address: "Nekede Road", lga: "Owerri West", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Water 24/7", "Security", "Generator"],
    truthIndex: 88,
    owner: { name: "Mr. Emeka Nnadi", verified: true },
  },
  {
    id: "s2",
    title: "Shared 2-Bedroom Flat near Poly Nekede",
    price: 75000,
    location: { address: "Akwakuma Junction", lga: "Owerri West", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 2, bathrooms: 1,
    amenities: ["Security", "Fence", "Shared Bathroom"],
    truthIndex: 0,
    owner: { name: "Mrs. Ngozi Eze", verified: false },
  },
  {
    id: "s3",
    title: "Premium Self-Contain, Walking Distance from FUTO",
    price: 180000,
    location: { address: "Ihiagwa Community Road", lga: "Owerri West", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Water 24/7", "Generator", "Security", "Fence", "WIFI Ready"],
    truthIndex: 91,
    owner: { name: "Chief Chukwuemeka Obi", verified: true },
  },
  {
    id: "s4",
    title: "Room & Parlour near FUTO New Site",
    price: 95000,
    location: { address: "Obinze Road", lga: "Owerri West", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Security"],
    truthIndex: 22,
    owner: { name: "Unknown Agent", verified: false },
  },
  {
    id: "s5",
    title: "Furnished Self-Contain near IMSU, Douglas Road",
    price: 150000,
    location: { address: "Douglas Road", lga: "Owerri Municipal", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Furnished", "Generator", "Water 24/7", "Kitchen"],
    truthIndex: 76,
    owner: { name: "Dr. Amaka Nwosu", verified: true },
  },
  {
    id: "s6",
    title: "Shared Flat near Alvan Ikoku, Owerri",
    price: 85000,
    location: { address: "Aladinma Estate", lga: "Owerri Municipal", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 2, bathrooms: 1,
    amenities: ["Security", "Parking"],
    truthIndex: 45,
    owner: { name: "Mr. Ifeanyi Oguike", verified: false },
  },
  {
    id: "s7",
    title: "BQ Room near Imo Poly Umuagwo",
    price: 60000,
    location: { address: "Umuagwo Road", lga: "Ohaji/Egbema", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Security", "Fence"],
    truthIndex: 55,
    owner: { name: "Mr. Obiechina", verified: true },
  },
  {
    id: "s8",
    title: "Luxury Self-Contain, New Owerri Housing Estate",
    price: 250000,
    location: { address: "New Owerri Housing Estate", lga: "Owerri Municipal", state: "Imo" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Water 24/7", "Generator", "Security", "WIFI Ready", "Furnished", "Parking"],
    truthIndex: 94,
    owner: { name: "Chisom Properties Ltd", verified: true },
  },
];

const PRICE_RANGES = [
  { label: "₦0 – ₦50k", min: 0, max: 50000 },
  { label: "₦50k – ₦150k", min: 50000, max: 150000 },
  { label: "₦150k – ₦300k", min: 150000, max: 300000 },
  { label: "₦300k+", min: 300000, max: Infinity },
];

const STUDENT_AMENITY_OPTIONS = [
  "Water 24/7", "Security", "Generator", "Self-Contain", "Shared Bathroom",
  "Kitchen", "Parking", "Fence", "WIFI Ready", "Furnished",
];

// ─── Inner component (uses useSearchParams) ───────────────────────────────────

function StudentListingsContent() {
  const params = useSearchParams();
  const initialSchool = params.get("school") ?? "";

  const [search, setSearch] = useState("");
  const [selectedSchool, setSelectedSchool] = useState(initialSchool);
  const [priceRange, setPriceRange] = useState<typeof PRICE_RANGES[number] | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const activeSchool = selectedSchool ? getSchoolById(selectedSchool) : null;

  const filtered = useMemo(() => {
    return STUDENT_LISTINGS.filter((l) => {
      if (search && !l.title.toLowerCase().includes(search.toLowerCase()) &&
          !l.location.address.toLowerCase().includes(search.toLowerCase())) return false;
      if (verifiedOnly && l.truthIndex < 70) return false;
      if (priceRange && (l.price < priceRange.min || l.price > priceRange.max)) return false;
      if (selectedAmenities.length > 0 && !selectedAmenities.every((a) => l.amenities?.includes(a))) return false;
      return true;
    });
  }, [search, verifiedOnly, priceRange, selectedAmenities]);

  function toggleAmenity(a: string) {
    setSelectedAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/students" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#0B1B2B]">
            <ArrowLeft className="h-4 w-4" /> Student Housing
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#0B1B2B" />
              <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
              <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
            </svg>
            <span className="font-bold text-[#0B1B2B]">Lodgist</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B1B2B]">
            {activeSchool ? `Student Lodges near ${activeSchool.shortName}` : "Student Housing — Imo State"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {filtered.length} verified and unverified listings · sorted by Trust Index
          </p>
        </div>

        {/* Search + Filter bar */}
        <div className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or area..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-2 shrink-0", showFilters && "border-[#1ABC9C] text-[#1ABC9C]")}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {(verifiedOnly || priceRange || selectedAmenities.length > 0 || selectedSchool) && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#FF6F3C]" />
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mb-6 rounded-xl border bg-white p-5 space-y-5">
            {/* School filter */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">School</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedSchool("")}
                  className={cn("rounded-full px-3 py-1 text-xs font-medium border transition",
                    !selectedSchool ? "bg-[#0B1B2B] text-white border-[#0B1B2B]" : "bg-white text-gray-600 hover:border-gray-400"
                  )}
                >All Schools</button>
                {IMO_STATE_SCHOOLS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSchool(s.id)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium border transition",
                      selectedSchool === s.id ? "bg-[#0B1B2B] text-white border-[#0B1B2B]" : "bg-white text-gray-600 hover:border-gray-400"
                    )}
                  >{s.shortName}</button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">Annual Rent</label>
              <div className="flex flex-wrap gap-2">
                {PRICE_RANGES.map((r) => (
                  <button
                    key={r.label}
                    onClick={() => setPriceRange(priceRange?.label === r.label ? null : r)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium border transition",
                      priceRange?.label === r.label ? "bg-[#1ABC9C] text-white border-[#1ABC9C]" : "bg-white text-gray-600 hover:border-gray-400"
                    )}
                  >{r.label}</button>
                ))}
              </div>
            </div>

            {/* Verified only */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
                  verifiedOnly ? "bg-[#1ABC9C]" : "bg-gray-200"
                )}
                role="switch"
                aria-checked={verifiedOnly}
              >
                <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  verifiedOnly ? "translate-x-4" : "translate-x-0")} />
              </button>
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Shield className="h-4 w-4 text-[#1ABC9C]" />
                Verified only (Truth Index 70+)
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="mb-2 block text-xs font-semibold text-gray-700 uppercase tracking-wide">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {STUDENT_AMENITY_OPTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleAmenity(a)}
                    className={cn("rounded-full px-3 py-1 text-xs font-medium border transition",
                      selectedAmenities.includes(a) ? "bg-[#0B1B2B] text-white border-[#0B1B2B]" : "bg-white text-gray-600 hover:border-gray-400"
                    )}
                  >{a}</button>
                ))}
              </div>
            </div>

            {/* Clear */}
            <button
              onClick={() => { setSelectedSchool(""); setPriceRange(null); setVerifiedOnly(false); setSelectedAmenities([]); }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" /> Clear all filters
            </button>
          </div>
        )}

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <p className="text-lg font-medium">No listings match your filters.</p>
            <p className="text-sm mt-1">Try removing some filters or selecting a different school.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered
              .sort((a, b) => b.truthIndex - a.truthIndex)
              .map((listing) => (
                <PropertyCard key={listing.id} listing={listing} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Exported page with Suspense (required for useSearchParams) ──────────────

export default function StudentListingsPage() {
  return (
    <Suspense>
      <StudentListingsContent />
    </Suspense>
  );
}
