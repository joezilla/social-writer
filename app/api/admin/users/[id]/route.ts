import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, AuthError } from "@/lib/auth-context";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin();
    const { enabled, role } = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (role === "admin" || role === "user") updateData.role = role;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, email: true, name: true, role: true, enabled: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await requireAdmin();

    if (params.id === userId) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
