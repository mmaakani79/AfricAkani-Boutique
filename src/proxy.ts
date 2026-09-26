import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import {
  MAINTENANCE_BYPASS_COOKIE,
  BYPASS_COOKIE_MAX_AGE,
  isMaintenanceModeEnabled,
  checkBypassKey,
  createBypassToken,
  verifyBypassToken,
} from "@/lib/maintenance";
import { renderMaintenancePage } from "@/lib/maintenance-page";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|icon.png|logo/|photos/).*)",
  ],
};

const MAINTENANCE_RETRY_AFTER_SECONDS = 3600;

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Admin and cron endpoints are never affected by maintenance mode — the
  // admin keeps its own login gate below, and the cron job authenticates
  // itself with CRON_SECRET.
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await verifySessionToken(token);
    if (!valid) {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/webhooks")
  ) {
    return NextResponse.next();
  }

  if (!isMaintenanceModeEnabled()) {
    return NextResponse.next();
  }

  // Owner preview bypass: already has a valid bypass cookie.
  const existingBypass = request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value;
  if (await verifyBypassToken(existingBypass)) {
    return NextResponse.next();
  }

  // Owner preview bypass: ?preview=<MAINTENANCE_BYPASS_KEY> — set the cookie
  // and redirect to the same URL with the key stripped out.
  const previewKey = request.nextUrl.searchParams.get("preview");
  if (checkBypassKey(previewKey)) {
    const token = await createBypassToken();
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("preview");
    const response = NextResponse.redirect(cleanUrl);
    if (token) {
      response.cookies.set(MAINTENANCE_BYPASS_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: BYPASS_COOKIE_MAX_AGE,
      });
    }
    return response;
  }

  return new NextResponse(renderMaintenancePage(), {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": String(MAINTENANCE_RETRY_AFTER_SECONDS),
    },
  });
}
