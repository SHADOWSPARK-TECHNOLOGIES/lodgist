import type { Metadata } from "next";
import Link from "next/link";
import NekedeRoomCard from "@/components/NekedeRoomCard";
import { ADVERTISE_HREF, ARTICLE_HREF, nekedePage } from "@/lib/nekedePilot";

export const metadata: Metadata = {
  title: nekedePage.metaTitle,
  description: nekedePage.metaDescription,
};

export default function NekedePage() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-orange)" }}>
          {nekedePage.kicker}
        </p>
        <h1 className="font-poppins text-3xl md:text-4xl font-bold text-white mb-4">
          {nekedePage.title}
        </h1>
        <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.7)" }}>
          {nekedePage.intro}
        </p>

        <section className="card text-left mb-8" aria-label={nekedePage.todayTitle}>
          <h2 className="font-poppins text-xl font-bold text-white mb-4">{nekedePage.todayTitle}</h2>
          <ul className="space-y-3 text-sm" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
            {nekedePage.today.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-sm mt-4" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{nekedePage.sourceRule}</p>
          <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{nekedePage.adsRule}</p>
        </section>

        <p className="text-sm mb-8">
          <Link href={ARTICLE_HREF} style={{ color: "var(--color-teal)" }}>{nekedePage.articleLink}</Link>
          <span style={{ color: "rgba(255,255,255,0.35)" }}> · </span>
          <Link href={ADVERTISE_HREF} style={{ color: "var(--color-teal)" }}>{nekedePage.advertiseLink}</Link>
        </p>

        <section className="card text-left mb-8" aria-label={nekedePage.example.aria}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-orange)" }}>
            {nekedePage.example.label}
          </p>
          <h2 className="font-poppins text-2xl font-bold text-white">{nekedePage.example.title}</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            {nekedePage.example.landlord}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
            {nekedePage.example.fees.map(([label, value]) => (
              <div key={label}>
                <dt style={{ color: "rgba(255,255,255,0.5)" }}>{label}</dt>
                <dd className="text-white font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-white mt-4">{nekedePage.example.body}</p>
          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            {nekedePage.example.footer}
          </p>
        </section>

        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          {nekedePage.localNote}
        </p>
        <NekedeRoomCard />
      </div>
    </div>
  );
}
