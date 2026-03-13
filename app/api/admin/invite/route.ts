import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth-context";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { email, role } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const inviteToken = randomBytes(32).toString("hex");
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "",
        role: role === "admin" ? "admin" : "user",
        inviteToken,
        inviteExpires,
      },
      select: { id: true, email: true, role: true },
    });

    const inviteUrl = `/invite?token=${inviteToken}`;

    return NextResponse.json({ user, inviteUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
