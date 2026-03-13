import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getAuthorizationUrl } from "@/lib/linkedin";
import { requireAuth, AuthError } from "@/lib/auth-context";

export async function POST() {
  try {
    await requireAuth();

    const state = randomBytes(16).toString("hex");
    const cookieStore = cookies();
    cookieStore.set("linkedin_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const url = await getAuthorizationUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
