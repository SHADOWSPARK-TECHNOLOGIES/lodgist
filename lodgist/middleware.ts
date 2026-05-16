import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// ─── Role-based route protection ─────────────────────────────────────────────
// Maps route prefixes to allowed roles.
// Canonical RoleName enum: USER, ARTISAN, LANDLORD, STUDIO_ADMIN, TENANT, AGENT

const ROLE_GUARDS: Record<string, string[]> = {
  "/admin": ["STUDIO_ADMIN"],
  "/landlord": ["LANDLORD", "STUDIO_ADMIN"],
  "/agent": ["AGENT", "STUDIO_ADMIN"],
  "/dashboard": ["STUDIO_ADMIN", "LANDLORD", "AGENT", "TENANT", "USER"],
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
