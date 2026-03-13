import { NextResponse } from "next/server";
import {
  SETTING_DEFINITIONS,
  USER_SETTING_KEYS,
  setSetting,
  deleteSetting,
  setUserSetting,
  deleteUserSetting,
} from "@/lib/settings";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function PUT(
  request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = params;
    const { userId, role } = await requireAuth();
    const { value } = await request.json();

    if (typeof value !== "string" || value.trim() === "") {
      return NextResponse.json({ error: "Value must be a non-empty string" }, { status: 400 });
    }

    // Per-user settings
    if (USER_SETTING_KEYS.includes(key)) {
      await setUserSetting(userId, key, value.trim());
      return NextResponse.json({ ok: true });
    }

    // Global settings require admin
    if (!SETTING_DEFINITIONS[key]) {
      return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await setSetting(key, value.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`Failed to save setting ${params.key}:`, err);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { key: string } }
) {
  try {
    const { key } = params;
    const { userId, role } = await requireAuth();

    if (USER_SETTING_KEYS.includes(key)) {
      await deleteUserSetting(userId, key);
      return NextResponse.json({ ok: true });
    }

    if (!SETTING_DEFINITIONS[key]) {
      return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteSetting(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`Failed to delete setting ${params.key}:`, err);
    return NextResponse.json({ error: "Failed to delete setting" }, { status: 500 });
  }
}
