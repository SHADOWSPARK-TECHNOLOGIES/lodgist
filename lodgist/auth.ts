import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import type { Adapter } from "next-auth/adapters"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { getServerSession, type SessionStrategy } from "next-auth"

// ─── Extend built-in types to carry role ─────────────────────────────────────

declare module "next-auth" {
  interface User {
    role: string
  }
  interface Session {
    user: {
      id?: string | null
      name?: string | null
      email?: string | null
      image?: string | null
      role?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    id: string
  }
}

// ─── OAuth provider availability ─────────────────────────────────────────────
// Only include a provider when both ID and secret are present.
// Empty strings produce cryptic NextAuth errors — fail clearly instead.

const githubConfigured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
const googleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (process.env.NODE_ENV === "production") {
  if (!githubConfigured) console.warn("[Auth] GitHub OAuth disabled — GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET not set");
  if (!googleConfigured) console.warn("[Auth] Google OAuth disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set");
}

// ─── NextAuth Configuration Options ──────────────────────────────────────────

export const authOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    ...(githubConfigured
      ? [GitHub({ clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! })]
      : []),
    ...(googleConfigured
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}

// ─── auth() helper — wraps getServerSession for the v5-style API ─────────────
// This allows callers (import { auth } from "@/auth") to use await auth()
// instead of the more verbose getServerSession(authOptions).

export async function auth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getServerSession(authOptions as any)
}
