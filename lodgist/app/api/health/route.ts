import { NextResponse } from "next/server";

export async function GET() {
  let database: "connected" | "unavailable" = "unavailable";

  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.user.count();
    database = "connected";
  } catch {
    database = "unavailable";
  }

  return NextResponse.json({
    status: database === "connected" ? "ok" : "degraded",
    service: "lodgist-web",
    database,
  });
}
