"use client";

import { useState } from "react";

interface Props {
  onSearch: (query: string) => void;
  loading: boolean;
  initialQuery?: string;
}

const EXAMPLES = [
  "Self-contain near FUTO under ₦100k",
  "2-bedroom flat in Owerri with generator",
  "Cheap lodge near Poly Nekede",
  "Apartment around IMSU under ₦150k",
];

export default function SearchBar({
  onSearch,
  loading,
  initialQuery = "",
}: Props) {
  const [query, setQuery] = useState(initialQuery);

  function submit() {
    const trimmed = query.trim();
    if (trimmed && !loading) onSearch(trimmed);
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Tell me what you're looking for..."
          className="w-full px-5 py-4 pr-32 text-base text-[#0B1B2B] bg-white
                     border-2 border-gray-200 rounded-2xl shadow-sm
                     focus:outline-none focus:border-[#1ABC9C] transition-colors
                     placeholder:text-gray-400"
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={loading || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2
                     bg-[#FF6F3C] hover:bg-[#e85e2d] disabled:opacity-40
                     text-white font-semibold text-sm
                     px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Searching
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              Search
            </>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3 justify-center">
        {EXAMPLES.map((example, i) => (
          <button
            key={i}
            onClick={() => {
              setQuery(example);
              onSearch(example);
            }}
            disabled={loading}
            className="text-xs bg-white hover:bg-[#1ABC9C]/10 hover:text-[#1ABC9C]
                       text-gray-600 px-3 py-1.5 rounded-full transition-colors
                       border border-gray-200 disabled:opacity-50"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}
