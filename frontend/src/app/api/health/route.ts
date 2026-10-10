import { NextResponse } from "next/server";
import { healthPayload } from "@/lib/health";

// Liveness only: no DB, no upstream fetch.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(healthPayload(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
