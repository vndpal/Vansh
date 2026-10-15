import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clearAttempts, countAttempt, MAX_ATTEMPTS } from "@/lib/rate-limit";
import { authConfig, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const config = authConfig();
  if ("error" in config) return NextResponse.json({ error: `Server is not set up: ${config.error}` }, { status: 500 });

  const ip = clientIp(request);
  let attempt;
  try {
    attempt = await countAttempt(ip);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not reach the database. Please try again." }, { status: 500 });
  }
  if (attempt.count > MAX_ATTEMPTS) {
    const minutes = Math.ceil(attempt.retryAfterSeconds / 60);
    return NextResponse.json(
      { error: `Too many wrong attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` },
      { status: 429, headers: { "Retry-After": String(attempt.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const pin = typeof body?.pin === "string" ? body.pin : "";
  if (!/^\d{6}$/.test(pin) || !timingSafeEqual(Buffer.from(pin), Buffer.from(config.pin))) {
    const left = MAX_ATTEMPTS - attempt.count;
    return NextResponse.json(
      { error: left > 0 ? `Wrong PIN. ${left} attempt${left === 1 ? "" : "s"} left.` : "Wrong PIN. Too many attempts, try again in 15 minutes." },
      { status: 401 },
    );
  }

  await clearAttempts(ip);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(config), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
