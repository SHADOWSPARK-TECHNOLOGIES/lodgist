import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

    // ── Find role ─────────────────────────────────────────────────────────
    const roleRecord = await prisma.role.findUnique({
      where: { name: role as "TENANT" | "LANDLORD" | "AGENT" },
    });

    if (!roleRecord) {
      return NextResponse.json(
        { message: "Invalid role specified." },
        { status: 400 },
      );
    }

    // ── Hash password & create user in transaction ────────────────────────
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          phone: phone || null,
          stateOfOrigin,
          roleId: roleRecord.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          stateOfOrigin: true,
          role: { select: { name: true } },
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role.name,
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
