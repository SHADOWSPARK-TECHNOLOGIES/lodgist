import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container py-16 max-w-xl text-center">
      <h1 className="font-poppins font-semibold text-white text-2xl mb-3">This page is not on Lodgist</h1>
      <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.75)" }}>
        The link may be wrong or out of date.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/listings" className="btn btn-primary">See all homes</Link>
        <Link href="/" className="btn btn-secondary">Go to the home page</Link>
      </div>
    </div>
  );
}
