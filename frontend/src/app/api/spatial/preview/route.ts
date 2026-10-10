import { NextResponse } from "next/server";
import { buildPreviewModel } from "@/lib/spatialPublic";

export const dynamic = "force-dynamic";

const headers = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const model = buildPreviewModel(url.searchParams.get("scenario") || "approximate", url.searchParams.get("campus") || "fpno");
  if (!model) {
    return NextResponse.json(
      { success: false, error: "unavailable", fixture: true, inventory: "excluded" },
      { status: 404, headers },
    );
  }
  return NextResponse.json({ success: true, data: model }, { headers });
}
