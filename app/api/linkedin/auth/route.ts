import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { getAuthorizationUrl } from "@/lib/linkedin";

export async function POST() {
  const state = randomBytes(16).toString("hex");
  const cookieStore = cookies();
  cookieStore.set("linkedin_oauth_state", state, {
    httpOnly: true,
    secure: false, // localhost
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const url = getAuthorizationUrl(state);
  return NextResponse.json({ url });
}
