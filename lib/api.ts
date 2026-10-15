import { NextResponse, type NextRequest } from "next/server";
import { isValidSession, SESSION_COOKIE } from "./session";
import { TreeError } from "./tree";

/** Wraps a route handler: re-checks the session and turns errors into JSON responses. */
export async function handle(request: NextRequest, run: () => Promise<Response>): Promise<Response> {
  if (!(await isValidSession(request.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  }
  try {
    return await run();
  } catch (error) {
    if (error instanceof TreeError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong." }, { status: 500 });
  }
}
