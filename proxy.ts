import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "./lib/session";

// Runs before every page and API route (Next.js 16 calls middleware "proxy").
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const loggedIn = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" || pathname === "/api/login") {
    return loggedIn && pathname === "/login" ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next();
  }
  if (loggedIn) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
