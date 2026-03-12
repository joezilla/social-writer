import { NextResponse } from "next/server";
import { getAllSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = await getAllSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("Failed to load settings:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}
