import type { Person } from "./types";

/** Calls one of the tree API routes and returns the updated list of people. */
export async function sendTreeRequest(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<Person[]> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Please log in again.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status}).`);
  return data.people as Person[];
}
