import { NextResponse } from "next/server";
import { SETTING_DEFINITIONS, setSetting, deleteSetting } from "@/lib/settings";

export async function PUT(
  request: Request,
  { params }: { params: { key: string } }
) {
  const { key } = params;

  if (!SETTING_DEFINITIONS[key]) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  try {
    const { value } = await request.json();
    if (typeof value !== "string" || value.trim() === "") {
      return NextResponse.json({ error: "Value must be a non-empty string" }, { status: 400 });
    }

    await setSetting(key, value.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Failed to save setting ${key}:`, err);
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { key: string } }
) {
  const { key } = params;

  if (!SETTING_DEFINITIONS[key]) {
    return NextResponse.json({ error: "Unknown setting key" }, { status: 400 });
  }

  try {
    await deleteSetting(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`Failed to delete setting ${key}:`, err);
    return NextResponse.json({ error: "Failed to delete setting" }, { status: 500 });
  }
}
