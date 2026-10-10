import type { Metadata } from "next";
import AdvertiserIntake from "@/components/AdvertiserIntake";
import { advertise as copy } from "@/lib/copy";

export const metadata: Metadata = {
  title: copy.metaTitle,
  description: copy.body,
};

export default function AdvertisePage() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto text-center mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-orange)" }}>
          {copy.badge}
        </p>
        <h1 className="font-poppins text-3xl md:text-4xl font-bold text-white mb-4">{copy.title}</h1>
        <p className="text-base mb-3" style={{ color: "rgba(255,255,255,0.7)" }}>{copy.body}</p>
        <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>{copy.rule}</p>
      </div>

      <AdvertiserIntake />

      <div className="max-w-2xl mx-auto mt-10 grid gap-6 md:grid-cols-2 text-left">
        <div className="card">
          <h2 className="font-poppins font-semibold text-white mb-3">{copy.includedTitle}</h2>
          <ul className="space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {copy.included.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2 className="font-poppins font-semibold text-white mb-3">{copy.excludedTitle}</h2>
          <ul className="space-y-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {copy.excluded.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
