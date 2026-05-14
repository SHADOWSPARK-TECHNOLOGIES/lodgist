"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PropertyCard from "../../../../lodgist/components/PropertyCard";

interface Property {
  id: string;
  plotNumber: string;
  ownerName: string;
  location: string;
  status: string;
  imageUrl: string;
  price: number;
  currency: string;
  beds: number;
  baths: number;
  sqft: number;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [listings, setListings] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!API_URL) {
      setError("API_URL is not defined. Please set NEXT_PUBLIC_API_URL environment variable.");
      return;
    }

    const fetchListings = async () => {
      setLoading(true);
      setError(null);
      try {
        const query = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : "";
        const response = await fetch(`${API_URL}/api/listings${query}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setListings(data);
      } catch (e: any) {
        setError(`Failed to fetch listings: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchListings();
  }, [searchTerm, API_URL]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (searchTerm) {
      newSearchParams.set("q", searchTerm);
    } else {
      newSearchParams.delete("q");
    }
    router.push(`/search?${newSearchParams.toString()}`);
  };

  const dummyProperty: Property = {
    id: "dummy-1",
    plotNumber: "PLT-001",
    ownerName: "John Doe",
    location: "GRA Phase 2, Port Harcourt",
    status: "available",
    imageUrl: "https://via.placeholder.com/400x300?text=Property+Image",
    price: 1_500_000,
    currency: "NGN",
    beds: 3,
    baths: 2,
    sqft: 1800,
  };


  return (
    <div className="flex min-h-screen flex-col items-center bg-deep-navy font-sans text-off-white">
      <header className="w-full bg-deep-navy/90 py-4 shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-heading text-2xl font-bold text-teal">
            Lodgist
          </Link>
          <nav>
            <Link href="/dashboard" className="text-light-gray hover:text-teal">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="w-full max-w-7xl flex-1 px-6 py-12">
        <h1 className="mb-8 text-center font-heading text-4xl font-bold">
          Find Your Next Home
        </h1>

        <form onSubmit={handleSearch} className="mx-auto mb-12 max-w-2xl">
          <div className="flex rounded-full bg-deep-navy-light shadow-lg">
            <input
              type="text"
              placeholder="Search by location, keywords, etc."
              className="flex-1 rounded-l-full border-none bg-transparent px-6 py-3 text-lg text-off-white placeholder-light-gray focus:outline-none focus:ring-2 focus:ring-teal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-r-full bg-vibrant-orange px-6 py-3 text-lg font-semibold text-white transition-colors duration-200 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-vibrant-orange focus:ring-offset-2 focus:ring-offset-deep-navy"
            >
              Search
            </button>
          </div>
        </form>

        {error && (
          <div className="mx-auto mb-8 max-w-2xl rounded-md bg-red-800/20 p-4 text-red-400">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            // Loading state skeleton
            Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-lg bg-deep-navy-light p-4 shadow-lg"
              >
                <div className="mb-4 h-48 w-full rounded bg-gray-700"></div>
                <div className="mb-2 h-4 w-3/4 rounded bg-gray-700"></div>
                <div className="h-4 w-1/2 rounded bg-gray-700"></div>
              </div>
            ))
          ) : listings.length > 0 ? (
            // Display actual listings
            listings.map((listing) => (
              <PropertyCard
                key={listing.id}
                property={{
                  id: listing.id,
                  plotNumber: listing.plotNumber,
                  ownerName: listing.ownerName,
                  location: listing.location,
                  status: listing.status,
                  imageUrl: listing.imageUrl,
                  price: listing.price,
                  currency: listing.currency,
                  beds: listing.beds,
                  baths: listing.baths,
                  sqft: listing.sqft,
                }}
              />
            ))
          ) : (
            // No results found
            <div className="col-span-full text-center text-light-gray">
              {searchTerm ? (
                <p>No listings found for "{searchTerm}". Try a different search.</p>
              ) : (
                <p>Start your search to find amazing properties!</p>
              )}
               <p className="mt-4 text-sm">
                In a real application, you would see actual listings here.
                For now, here's a dummy property card:
              </p>
              <div className="mt-8 flex justify-center">
                <PropertyCard property={dummyProperty} />
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="mt-12 w-full bg-deep-navy/90 py-8 text-center text-light-gray">
        <p>&copy; 2026 Lodgist. All rights reserved.</p>
      </footer>
    </div>
  );
}

