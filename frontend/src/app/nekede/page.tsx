import type { Metadata } from "next";
import NekedeRoomCard from "@/components/NekedeRoomCard";

export const metadata: Metadata = {
  title: "Nekede — no reviewed room yet",
  description:
    "Lodgist has not published a reviewed room near Federal Polytechnic Nekede. The example on this page is not a listing.",
};

export default function NekedePage() {
  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--color-orange)" }}>
          Nekede · no reviewed room
        </p>
        <h1 className="font-poppins text-3xl md:text-4xl font-bold text-white mb-4">
          Nothing to rent here yet.
        </h1>
        <p className="text-base mb-8" style={{ color: "rgba(255,255,255,0.7)" }}>
          Lodgist has not reviewed a room near Federal Polytechnic Nekede. The card below is an example of the note format. It is not a home.
        </p>

        <section className="card text-left mb-8" aria-label="Example only">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--color-orange)" }}>
            Example only · not a home · not for rent
          </p>
          <h2 className="font-poppins text-2xl font-bold text-white">Example Lodge</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            Not a real landlord. No WhatsApp number.
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm mt-4">
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Rent</dt><dd className="text-white font-semibold">Example figure, not a bill</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Agency</dt><dd className="text-white font-semibold">Example figure, not a bill</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Legal</dt><dd className="text-white font-semibold">Example figure, not a bill</dd></div>
            <div><dt style={{ color: "rgba(255,255,255,0.5)" }}>Caution</dt><dd className="text-white font-semibold">Example figure, not a bill</dd></div>
          </dl>
          <p className="text-sm text-white mt-4">One empty self-contain, written here only to show the layout.</p>
          <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Not a verified badge. Not a Trust Score. Students cannot enquire about this example.
          </p>
        </section>

        <NekedeRoomCard />
      </div>
    </div>
  );
}
