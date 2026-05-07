import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// ─── Role-based route protection ─────────────────────────────────────────────
// Maps route prefixes to allowed roles.
// The RoleName enum in prisma/schema.prisma defines: ADMIN, AGENT, LANDLORD, TENANT
// STUDIO_ADMIN is mapped to ADMIN for middleware purposes.

const ROLE_GUARDS: Record<string, string[]> = {
  "/admin": ["ADMIN", "STUDIO_ADMIN"],
  "/landlord": ["LANDLORD", "ADMIN", "STUDIO_ADMIN"],
  "/agent": ["AGENT", "ADMIN", "STUDIO_ADMIN"],
  "/dashboard": ["ADMIN", "STUDIO_ADMIN", "LANDLORD", "AGENT", "TENANT", "USER"],
};

export default withAuth(
  (req) => {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Find the most specific matching guard
    const matchedPrefix = Object.keys(ROLE_GUARDS)
      .sort((a, b) => b.length - a.length) // longest match first
      .find((prefix) => pathname.startsWith(prefix));

    if (matchedPrefix) {
      const allowedRoles = ROLE_GUARDS[matchedPrefix];
      const userRole = (token?.role as string) ?? "";

      if (!allowedRoles.includes(userRole)) {
        const url = new URL("/403", req.url);
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Must be logged in for any protected route
        return !!token;
      },
    },
  },
);

// ─── Matcher config — only run on protected routes ───────────────────────────

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/landlord/:path*",
    "/agent/:path*",
  ],
};
