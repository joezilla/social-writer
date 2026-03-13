import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        enabled: true,
        createdAt: true,
        _count: { select: { posts: true, voiceCorpusEntries: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { email, name, password, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
        role: role === "admin" ? "admin" : "user",
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
