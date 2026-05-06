import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  providers: [
    GitHub as any,
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
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
          include: { role: true }, // Include the role to attach it to the session
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password,
        )

        if (!isPasswordValid) {
          return null
        }

        // Return user object, NextAuth will automatically create a session
        return { id: user.id, name: user.name, email: user.email, role: user.role.name }
      },
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT strategy for session management
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role // Add user role to the JWT token
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string // Add user role to the session object
      }
      return session
    },
  },
  pages: {
    signIn: "/auth/signin", // Custom sign-in page (optional)
  }
})
