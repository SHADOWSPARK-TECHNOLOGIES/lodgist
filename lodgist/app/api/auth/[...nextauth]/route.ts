// Next.js App Router route handlers for NextAuth.js
// Uses NextAuth v4 pattern: NextAuth(authOptions) returns a handler function
// that handles both GET and POST requests.

import NextAuth from "next-auth"
import { authOptions } from "@/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
