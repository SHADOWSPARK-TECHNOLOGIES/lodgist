import type { Metadata } from "next";
import Link from "next/link";
import { brand, trustCenter } from "@/lib/copy";

export const metadata: Metadata = { title: trustCenter.metaTitle, description: trustCenter.intro };

export default function TrustPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-navy)" }}>
      <article className="container py-12 max-w-3xl">
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-teal)" }}>{brand.endorsement}</p>
        <h1 className="font-poppins font-bold text-white text-3xl mb-4">{trustCenter.title}</h1>
        <p className="mb-8" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{trustCenter.intro}</p>

        <h2 className="font-poppins font-semibold text-white text-xl mb-3">{trustCenter.checkedTitle}</h2>
        <ul className="space-y-2 mb-8">
          {trustCenter.checked.map((item) => (
            <li key={item} className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>✓ {item}</li>
          ))}
        </ul>

        <div className="card mb-8">
          <h2 className="font-poppins font-semibold text-white mb-2">{trustCenter.limitTitle}</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{trustCenter.limitBody}</p>
        </div>

        <h2 className="font-poppins font-semibold text-white text-xl mb-3">{trustCenter.reportTitle}</h2>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{trustCenter.reportBody}</p>
        <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.7 }}>{trustCenter.analytics}</p>
        <Link href="/listings" className="btn btn-primary">{trustCenter.browse}</Link>
      </article>
    </div>
  );
}
