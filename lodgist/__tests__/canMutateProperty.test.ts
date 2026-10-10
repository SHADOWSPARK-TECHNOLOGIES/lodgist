import { describe, expect, it } from "vitest";
import { canMutateProperty } from "@/lib/authz";

describe("canMutateProperty", () => {
  it("allows the integer owner when the session id is the matching string", () => {
    expect(
      canMutateProperty({ ownerId: 12, userId: "12", role: "LANDLORD" }),
    ).toBe(true);
  });

  it("denies a different owner", () => {
    expect(
      canMutateProperty({ ownerId: 12, userId: "7", role: "LANDLORD" }),
    ).toBe(false);
  });

  it("allows STUDIO_ADMIN for a property they do not own", () => {
    expect(
      canMutateProperty({ ownerId: 12, userId: "7", role: "STUDIO_ADMIN" }),
    ).toBe(true);
  });

  it("does not treat the legacy ADMIN label as an admin role", () => {
    expect(
      canMutateProperty({ ownerId: 12, userId: "7", role: "ADMIN" }),
    ).toBe(false);
  });

  it("rejects non-integer session ids", () => {
    expect(
      canMutateProperty({ ownerId: 12, userId: "12abc", role: "LANDLORD" }),
    ).toBe(false);
    expect(
      canMutateProperty({ ownerId: 12, userId: "", role: "USER" }),
    ).toBe(false);
  });
});
