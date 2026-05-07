"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1B2B] px-4">
      <div className="mx-auto max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-10 w-10 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Something went wrong
        </h1>

        {/* Message */}
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          We encountered an unexpected error. Our team has been notified.
          Please try again.
        </p>

        {/* Error detail (dev only) */}
        {process.env.NODE_ENV === "development" && (
          <p className="mt-4 rounded-lg bg-white/5 px-4 py-3 text-left font-mono text-xs text-red-300">
            {error.message}
          </p>
        )}

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg bg-[#FF6F3C] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e85d2c]"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/5"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
