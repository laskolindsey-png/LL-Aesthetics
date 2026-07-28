import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Protects every page. Anyone without a valid session is sent to /login.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets, the login page, and the health check.
  // The trailing (?!.*\.[\w]+$) also lets public files (logo.png, icons, etc.)
  // through so brand assets load on the login screen before sign-in.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|login|api/health|api/webhooks|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)",
  ],
};
