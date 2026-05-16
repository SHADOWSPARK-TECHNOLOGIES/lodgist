import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";

// ─── Role mapping: frontend-friendly names → DB Role enum values ────────────
// Packages/db uses: USER, ARTISAN, LANDLORD, STUDIO_ADMIN
// The frontend sends: TENANT, LANDLORD, AGENT
const ROLE_MAP: Record<string, Role> = {
  TENANT: "USER",
  LANDLORD: "LANDLORD",
  AGENT: "ARTISAN",
};

// ─── POST /api/auth/register — Create a new user account ────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, phone, stateOfOrigin } = body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { message: "Name, email, password, and role are required." },
        { status: 400 },
      );
    }

    if (typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { message: "Name must be at least 2 characters." },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: "Please provide a valid email address." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const validRoles = ["TENANT", "LANDLORD", "AGENT"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { message: "Role must be one of: TENANT, LANDLORD, AGENT." },
        { status: 400 },
      );
    }

    if ((role === "LANDLORD" || role === "AGENT") && (!phone || typeof phone !== "string")) {
      return NextResponse.json(
        { message: "Phone number is required for landlords and agents." },
        { status: 400 },
      );
    }

    if (!stateOfOrigin || typeof stateOfOrigin !== "string") {
      return NextResponse.json(
        { message: "State of origin is required." },
        { status: 400 },
      );
    }

    // ── Map frontend role to DB enum value ────────────────────────────────
    const dbRole = ROLE_MAP[role as keyof typeof ROLE_MAP];

    // ── Check for existing user ───────────────────────────────────────────
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 },
      );
    }

    // ── Hash password & create user ───────────────────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: hashedPassword,
          role: dbRole,
          phone: phone || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
