import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { count } },
}));

describe("GET /api/health", () => {
  beforeEach(() => {
    count.mockReset();
  });

  it("returns ok when the database answers", async () => {
    count.mockResolvedValue(0);
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "ok",
      service: "lodgist-web",
      database: "connected",
    });
  });

  it("returns degraded without error details when the database is down", async () => {
    count.mockRejectedValue(new Error("secret connection string"));
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: "degraded",
      service: "lodgist-web",
      database: "unavailable",
    });
    expect(JSON.stringify(body)).not.toContain("secret");
  });
});
