import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { token, password } = await request.json();

  if (!token || !password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Token and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { inviteToken: token },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid invite token" },
      { status: 400 }
    );
  }

  if (user.inviteExpires && user.inviteExpires < new Date()) {
    return NextResponse.json(
      { error: "Invite token has expired" },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteExpires: null,
    },
  });

  return NextResponse.json({ ok: true });
}
