import type { Metadata } from "next";
import { about, brand } from "@/lib/copy";

export const metadata: Metadata = { title: about.metaTitle, description: about.lead };

export default function AboutPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--color-navy)" }}>
      <article className="container py-12 max-w-3xl">
        <h1 className="font-poppins font-bold text-white text-3xl mb-4">Lodgist</h1>
        <p className="mb-4" style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{about.lead}</p>
        <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>{about.parent}</p>
        <p className="mt-8 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{brand.support}</p>
      </article>
    </div>
  );
}
