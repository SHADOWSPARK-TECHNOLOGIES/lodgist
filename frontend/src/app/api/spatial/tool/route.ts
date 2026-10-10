import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_KEYS = ["url", "providerUrl", "userUrl", "endpoint", "baseUrl", "tileUrl", "interpreterUrl"];

function hasUrlKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return URL_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key) && (value as Record<string, unknown>)[key] != null && (value as Record<string, unknown>)[key] !== "");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "malformed" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || hasUrlKey(body) || hasUrlKey((body as { input?: unknown }).input)) {
    return NextResponse.json({ ok: false, code: "forbidden" }, { status: 400 });
  }
  const record = body as { name?: unknown; input?: unknown };
  const name = typeof record.name === "string" ? record.name : "";
  const input = record.input && typeof record.input === "object" && !Array.isArray(record.input) ? record.input : {};
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000";
  try {
    const response = await fetch(`${base}/api/spatial/tool`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name, input }),
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, code: "unavailable" }, { status: 503 });
  }
}
