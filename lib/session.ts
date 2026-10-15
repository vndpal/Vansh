// Signed session cookie. Uses Web Crypto so it runs in the proxy and in route handlers.

export const SESSION_COOKIE = "family_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

type AuthConfig = { pin: string; secret: string } | { error: string };

export function authConfig(): AuthConfig {
  const pin = process.env.FAMILY_PIN ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (!/^\d{6}$/.test(pin)) return { error: "FAMILY_PIN must be set to exactly 6 digits." };
  if (secret.length < 32) return { error: "SESSION_SECRET must be set to at least 32 characters." };
  return { pin, secret };
}

const encoder = new TextEncoder();

// The PIN is part of the key, so changing FAMILY_PIN signs everyone out.
function hmacKey(config: { pin: string; secret: string }) {
  return crypto.subtle.importKey("raw", encoder.encode(`${config.secret}:${config.pin}`), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function createSessionToken(config: { pin: string; secret: string }): Promise<string> {
  const payload = `v1.${Date.now() + SESSION_MAX_AGE * 1000}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(config), encoder.encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  const config = authConfig();
  if ("error" in config || !token) return false;

  const dot = token.lastIndexOf(".");
  const payload = token.slice(0, dot);
  const signature = fromBase64Url(token.slice(dot + 1));
  const [version, expires] = payload.split(".");
  if (dot < 0 || !signature || version !== "v1" || !/^\d+$/.test(expires ?? "") || Number(expires) < Date.now()) {
    return false;
  }
  // crypto.subtle.verify compares in constant time.
  return crypto.subtle.verify("HMAC", await hmacKey(config), signature, encoder.encode(payload));
}
