"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, SlidersHorizontal, ChevronDown, X, MapPin, Star, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import PropertyCard from "@/components/PropertyCard";
import { getAllStateNames } from "@/lib/data/nigerianLgas";
import type { Listing } from "@/components/PropertyCard";

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_LISTINGS: Listing[] = [
  {
    id: "1",
    title: "Modern 3-Bedroom Apartment in Lekki Phase 1",
    price: 4500000,
    location: { address: "12 Admiralty Way", lga: "Eti Osa", state: "Lagos" },
    propertyType: "apartment",
    bedrooms: 3, bathrooms: 2,
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
    bedrooms: 4, bathrooms: 3,
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
    bedrooms: 2, bathrooms: 2,
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
    bedrooms: 5, bathrooms: 4,
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
  {
    id: "7",
    title: "Cozy 1-Bedroom Flat in Surulere",
    price: 1800000,
    location: { address: "15 Bode Thomas Street", lga: "Surulere", state: "Lagos" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Generator", "Security"],
    truthIndex: 45,
    owner: { name: "Adebayo Ogun", verified: false },
  },
  {
    id: "8",
    title: "3-Bedroom Terrace in New Haven, Enugu",
    price: 3800000,
    location: { address: "7 Chime Avenue", lga: "Enugu East", state: "Enugu" },
    propertyType: "house",
    bedrooms: 3, bathrooms: 2,
    amenities: ["Parking", "Garden"],
    truthIndex: 82,
    owner: { name: "Ifeanyi Obi", verified: true },
  },
  {
    id: "9",
    title: "Studio Apartment in Yaba",
    price: 1200000,
    location: { address: "42 Herbert Macaulay Way", lga: "Yaba", state: "Lagos" },
    propertyType: "apartment",
    bedrooms: 1, bathrooms: 1,
    amenities: ["Generator"],
    truthIndex: 58,
    owner: { name: "Tola Benson", verified: false },
  },
];

const PROPERTY_TYPES = ["All", "Apartment", "House", "Land", "Commercial"];

function formatNgn(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function SearchNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" className="shrink-0">
            <rect width="36" height="36" rx="8" fill="#0B1B2B" />
            <path d="M10 26V14L18 8L26 14V26H22V18H14V26H10Z" fill="#FF6F3C" />
            <rect x="14" y="20" width="8" height="6" fill="#1ABC9C" rx="1" />
          </svg>
          <span className="text-xl font-bold tracking-tight text-[#0B1B2B]">Lodgist</span>
        </Link>
        <Link href="/verify" className="text-sm font-medium text-[#FF6F3C] hover:underline">
          Verify a Listing
        </Link>
      </div>
    </header>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────────────

function FilterBar({
  searchQuery, setSearchQuery,
  selectedState, setSelectedState,
  selectedType, setSelectedType,
  minPrice, setMinPrice,
  maxPrice, setMaxPrice,
  minTrust, setMinTrust,
  verifiedOnly, setVerifiedOnly,
}: {
  searchQuery: string; setSearchQuery: (v: string) => void;
  selectedState: string; setSelectedState: (v: string) => void;
  selectedType: string; setSelectedType: (v: string) => void;
  minPrice: string; setMinPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  minTrust: string; setMinTrust: (v: string) => void;
  verifiedOnly: boolean; setVerifiedOnly: (v: boolean) => void;
}) {
  const states = getAllStateNames();
  const [showFilters, setShowFilters] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const activeFilterCount = [
    selectedState, selectedType !== "All", minPrice, maxPrice, minTrust, verifiedOnly,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Keyword search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by title, address, or landlord..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-input bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50 focus:border-[#1ABC9C]"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 border-dashed"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#FF6F3C] text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Expandable filter panel */}
      {showFilters && (
        <div className="rounded-xl border bg-gray-50 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* State */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">State</label>
              <button
                onClick={() => { setStateOpen(!stateOpen); setTypeOpen(false); }}
                className="flex w-full items-center justify-between rounded-lg border border-input bg-white px-3 py-2 text-sm"
              >
                <span className={selectedState ? "font-medium" : "text-muted-foreground"}>
                  {selectedState || "All States"}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", stateOpen && "rotate-180")} />
              </button>
              {stateOpen && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-white shadow-lg">
                  <button onClick={() => { setSelectedState(""); setStateOpen(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-[#1ABC9C]/5">
                    All States
                  </button>
                  {states.map(s => (
                    <button key={s} onClick={() => { setSelectedState(s); setStateOpen(false); }}
                      className={cn("w-full px-3 py-2 text-left text-sm hover:bg-[#1ABC9C]/10",
                        selectedState === s && "bg-[#1ABC9C]/10 font-medium text-[#1ABC9C]")}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Type */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</label>
              <button
                onClick={() => { setTypeOpen(!typeOpen); setStateOpen(false); }}
                className="flex w-full items-center justify-between rounded-lg border border-input bg-white px-3 py-2 text-sm"
              >
                <span className={selectedType !== "All" ? "font-medium" : "text-muted-foreground"}>
                  {selectedType === "All" || !selectedType ? "All Types" : selectedType}
                </span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", typeOpen && "rotate-180")} />
              </button>
              {typeOpen && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border bg-white shadow-lg">
                  {PROPERTY_TYPES.map(t => (
                    <button key={t} onClick={() => { setSelectedType(t); setTypeOpen(false); }}
                      className={cn("w-full px-3 py-2 text-left text-sm hover:bg-[#1ABC9C]/10",
                        selectedType === t && "bg-[#1ABC9C]/10 font-medium text-[#1ABC9C]")}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Min Price */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Min Price (₦)</label>
              <input type="number" placeholder="0" value={minPrice}
                onChange={e => setMinPrice(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50" />
            </div>

            {/* Max Price */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Price (₦)</label>
              <input type="number" placeholder="Any" value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50" />
            </div>

            {/* Min Truth Index */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Min Trust Score</label>
              <input type="number" min={0} max={100} placeholder="0" value={minTrust}
                onChange={e => setMinTrust(e.target.value)}
                className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50" />
            </div>

            {/* Verified only toggle */}
            <div className="flex items-end">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-white px-3 py-2 text-sm">
                <input type="checkbox" checked={verifiedOnly}
                  onChange={e => setVerifiedOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#1ABC9C] focus:ring-[#1ABC9C]" />
                <Shield className="h-4 w-4 text-[#1ABC9C]" />
                Verified Landlords Only
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sort & Results Bar ─────────────────────────────────────────────────────

function ResultsBar({ count, sortBy, setSortBy }: {
  count: number; sortBy: string; setSortBy: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-[#0B1B2B]">{count}</span> {count === 1 ? "property" : "properties"} found
      </p>
      <select value={sortBy} onChange={e => setSortBy(e.target.value)}
        className="rounded-lg border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1ABC9C]/50">
        <option value="default">Sort: Default</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
        <option value="trust-desc">Trust Score: High to Low</option>
        <option value="trust-asc">Trust Score: Low to High</option>
      </select>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const params = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState(params.get("state") ?? "");
  const [selectedType, setSelectedType] = useState(
    params.get("type")
      ? params.get("type")!.charAt(0).toUpperCase() + params.get("type")!.slice(1)
      : "All",
  );
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minTrust, setMinTrust] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("default");

  const filtered = useMemo(() => {
    let results = [...MOCK_LISTINGS];

    // Keyword search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.location.address.toLowerCase().includes(q) ||
        l.location.state.toLowerCase().includes(q) ||
        l.owner.name?.toLowerCase().includes(q)
      );
    }

    // State filter
    if (selectedState) {
      results = results.filter(l => l.location.state === selectedState);
    }

    // Type filter
    if (selectedType && selectedType !== "All") {
      results = results.filter(l => l.propertyType === selectedType.toLowerCase());
    }

    // Price range
    if (minPrice) results = results.filter(l => l.price >= Number(minPrice));
    if (maxPrice) results = results.filter(l => l.price <= Number(maxPrice));

    // Min trust score
    if (minTrust) results = results.filter(l => l.truthIndex >= Number(minTrust));

    // Verified only
    if (verifiedOnly) results = results.filter(l => l.owner.verified);

    // Sort
    switch (sortBy) {
      case "price-asc": results.sort((a, b) => a.price - b.price); break;
      case "price-desc": results.sort((a, b) => b.price - a.price); break;
      case "trust-desc": results.sort((a, b) => b.truthIndex - a.truthIndex); break;
      case "trust-asc": results.sort((a, b) => a.truthIndex - b.truthIndex); break;
    }

    return results;
  }, [searchQuery, selectedState, selectedType, minPrice, maxPrice, minTrust, verifiedOnly, sortBy]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SearchNavbar />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0B1B2B] sm:text-3xl">Find Your Verified Property</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every listing verified by our Truth Index Algorithm. No fraud. No middlemen.
          </p>
        </div>

        {/* Filters */}
        <FilterBar {...{
          searchQuery, setSearchQuery,
          selectedState, setSelectedState,
          selectedType, setSelectedType,
          minPrice, setMinPrice,
          maxPrice, setMaxPrice,
          minTrust, setMinTrust,
          verifiedOnly, setVerifiedOnly,
        }} />

        {/* Results */}
        <div className="mt-6">
          <ResultsBar count={filtered.length} sortBy={sortBy} setSortBy={setSortBy} />

          {filtered.length === 0 ? (
            <div className="mt-12 flex flex-col items-center gap-4 text-center">
              <Search className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="text-lg font-semibold text-[#0B1B2B]">No properties found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your filters or search terms.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery(""); setSelectedState(""); setSelectedType("All");
                  setMinPrice(""); setMaxPrice(""); setMinTrust(""); setVerifiedOnly(false);
                }}
              >
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(listing => (
                <PropertyCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
