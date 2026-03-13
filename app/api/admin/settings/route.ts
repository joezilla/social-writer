import { NextRequest, NextResponse } from "next/server";
import { getAllSettings, setSetting } from "@/lib/settings";
import { requireAdmin, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const { key, value } = await request.json();

    if (!key || typeof value !== "string") {
      return NextResponse.json(
        { error: "key and value are required" },
        { status: 400 }
      );
    }

    await setSetting(key, value);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
