import { NextResponse } from "next/server";
import { getAllSettings, getUserSettings } from "@/lib/settings";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    const { userId, role } = await requireAuth();

    // All users get their own user settings
    const userSettings = await getUserSettings(userId);

    // Admins also see global app settings
    let appSettings = undefined;
    if (role === "admin") {
      appSettings = await getAllSettings();
    }

    return NextResponse.json({ settings: appSettings ?? userSettings, userSettings });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Failed to load settings:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}
