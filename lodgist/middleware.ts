import { auth } from "./auth"
import { NextResponse, type NextRequest } from "next/server"

export default auth((req: NextRequest & { auth: unknown }) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth

  const protectedRoutes = {
    ADMIN: ["/dashboard/admin"],
    AGENT: ["/dashboard/agent"],
    LANDLORD: ["/dashboard/landlord"],
    TENANT: [], // Tenants might have a dashboard too, but not explicitly protected for now
  }

  // Redirect to login if not logged in and trying to access a protected route
  if (!isLoggedIn) {
    if (nextUrl.pathname.startsWith("/dashboard")) { // Generic check for any dashboard route
      return NextResponse.redirect(new URL("/api/auth/signin", nextUrl))
    }
    return NextResponse.next()
  }

  // If logged in, check role-based access
  const authObj = req.auth as { user?: { role?: string } } | undefined;
  const userRole = authObj?.user?.role as string | undefined;
  const urlPath = nextUrl.pathname

  if (urlPath.startsWith("/dashboard")) {
    if (urlPath.startsWith("/dashboard/admin") && userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl)) // Redirect to generic dashboard
    }
    if (urlPath.startsWith("/dashboard/agent") && userRole !== "AGENT") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
    if (urlPath.startsWith("/dashboard/landlord") && userRole !== "LANDLORD") {
      return NextResponse.redirect(new URL("/dashboard", nextUrl))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth).*)"],
}