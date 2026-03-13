import { NextResponse } from "next/server";
import { getStoredToken } from "@/lib/linkedin";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function GET() {
  try {
    const { userId } = await requireAuth();
    const token = await getStoredToken(userId);

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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
