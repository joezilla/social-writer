import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/invite", "/api/auth"];
const STATIC_PREFIXES = ["/_next", "/favicon.ico"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow static assets
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow cron endpoint with secret
  if (pathname.startsWith("/api/cron/")) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  const isAdmin =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  // Check authentication
  if (!req.auth) {
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check admin access
  if (isAdmin) {
    const role = (req.auth.user as { role?: string })?.role;
    if (role !== "admin") {
      if (isApi) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
