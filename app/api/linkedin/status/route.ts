import { NextResponse } from "next/server";
import { getStoredToken } from "@/lib/linkedin";

export async function GET() {
  const token = await getStoredToken();

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  const expired = token.expiresAt < new Date();

  return NextResponse.json({
    connected: !expired,
    expired,
    displayName: token.displayName,
    expiresAt: token.expiresAt.toISOString(),
  });
}
