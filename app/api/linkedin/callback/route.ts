import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/linkedin";
import { requireAuth } from "@/lib/auth-context";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_params", request.url)
    );
  }

  // Validate state
  const cookieStore = cookies();
  const storedState = cookieStore.get("linkedin_oauth_state")?.value;
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", request.url)
    );
  }

  // Clear the state cookie
  cookieStore.delete("linkedin_oauth_state");

  try {
    const { userId } = await requireAuth();
    await exchangeCodeForToken(code, userId);
    return NextResponse.redirect(new URL("/settings?linkedin=connected", request.url));
  } catch (err) {
    console.error("LinkedIn OAuth error:", err);
    return NextResponse.redirect(
      new URL(`/settings?error=token_exchange_failed`, request.url)
    );
  }
}
