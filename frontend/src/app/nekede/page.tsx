import type { Metadata } from "next";
import NekedeRoomCard from "@/components/NekedeRoomCard";

export const metadata: Metadata = {
  title: "Nekede — no reviewed room yet",
  description:
    "Lodgist has not published a reviewed room near Federal Polytechnic Nekede. This page is not a listing.",
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
          Lodgist has not reviewed a room near Federal Polytechnic Nekede. Fill this only after the person who controls the room says yes. It stays on your phone. It does not create a listing, a badge, or a Trust Score.
        </p>
        <NekedeRoomCard />
      </div>
    </div>
  );
}
