import type { Metadata } from "next";
import Link from "next/link";
import { supplyArticle } from "@/lib/nekedePilot";

export const metadata: Metadata = {
  title: supplyArticle.metaTitle,
  description: supplyArticle.metaDescription,
};

export default function NekedeSupplyArticle() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-navy)" }}>
      <article className="container py-12 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-orange)" }}>
          {supplyArticle.kicker}
        </p>
        <h1 className="font-poppins font-bold text-white text-3xl mb-4">{supplyArticle.title}</h1>
        <p className="mb-10" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{supplyArticle.standfirst}</p>

        {supplyArticle.sections.map((section) => (
          <section key={section.id} className="mb-10" aria-labelledby={`supply-${section.id}`}>
            <h2 id={`supply-${section.id}`} className="font-poppins font-semibold text-white text-xl mb-4">{section.heading}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card text-left">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-teal)" }}>English</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{section.english}</p>
              </div>
              <div className="card text-left" lang="pcm">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-orange)" }}>Nigerian Pidgin</p>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{section.pidgin}</p>
              </div>
            </div>
          </section>
        ))}

        <section className="mb-10" aria-labelledby="supply-facts">
          <h2 id="supply-facts" className="font-poppins font-semibold text-white text-xl mb-4">{supplyArticle.factsHeading}</h2>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{supplyArticle.factsIntro.english}</p>
            <p className="text-sm" lang="pcm" style={{ color: "rgba(255,255,255,0.8)", lineHeight: 1.7 }}>{supplyArticle.factsIntro.pidgin}</p>
          </div>
          <ol className="space-y-4">
            {supplyArticle.facts.map((fact, index) => (
              <li key={fact.id} className="card text-left">
                <div className="grid gap-3 md:grid-cols-2">
                  <p className="text-sm text-white">
                    <span style={{ color: "var(--color-orange)" }}>{index + 1}. </span>
                    {fact.english}
                  </p>
                  <p className="text-sm" lang="pcm" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>{fact.pidgin}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <p className="mb-3">
          <Link href={supplyArticle.advertiseHref} className="btn btn-primary">{supplyArticle.advertiseLabel}</Link>
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{supplyArticle.afterLink.english}</p>
          <p className="text-sm" lang="pcm" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{supplyArticle.afterLink.pidgin}</p>
        </div>
      </article>
    </div>
  );
}
