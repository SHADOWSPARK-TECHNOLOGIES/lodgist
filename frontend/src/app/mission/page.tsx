import type { Metadata } from "next";
import Link from "next/link";
import { mission } from "@/lib/copy";

export const metadata: Metadata = {
  title: mission.metaTitle,
  description: mission.lead,
};

export default function MissionPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-navy)" }}>
      <article className="container py-12 max-w-3xl">
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-teal)" }}>{mission.kicker}</p>
        <h1 className="font-poppins font-bold text-white text-3xl mb-4">{mission.title}</h1>
        <p className="mb-10" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{mission.lead}</p>

        <h2 className="font-poppins font-semibold text-white text-xl mb-2">{mission.boardTitle}</h2>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.55)" }}>{mission.boardNote}</p>
        <ul className="space-y-3 mb-10">
          {mission.rows.map((row) => (
            <li key={row.title} className="card">
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--color-orange)" }}>{row.status}</p>
              <h3 className="font-poppins font-semibold text-white mb-1">{row.title}</h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>{row.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="font-poppins font-semibold text-white text-xl mb-4">{mission.nextTitle}</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/trust" className="btn btn-primary">{mission.readTrust}</Link>
          <Link href="/advertise" className="btn btn-secondary">{mission.offerRoom}</Link>
          <Link href="/nekede" className="btn btn-secondary">{mission.seeNekede}</Link>
        </div>
      </article>
    </div>
  );
}
