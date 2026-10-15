import { redis } from "./store";

export const MAX_ATTEMPTS = 5;
export const WINDOW_SECONDS = 15 * 60;

// Counts an attempt and starts the 15 minute window on the first one, atomically.
const COUNT_ATTEMPT = `
local count = redis.call('INCR', KEYS[1])
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('TTL', KEYS[1])}`;

const keyFor = (ip: string) => `login-attempts:${ip}`;

/** Records a login attempt. A successful login clears the counter, so it ends up counting failures. */
export async function countAttempt(ip: string): Promise<{ count: number; retryAfterSeconds: number }> {
  const [count, ttl] = (await redis().eval(COUNT_ATTEMPT, [keyFor(ip)], [String(WINDOW_SECONDS)])) as [number, number];
  return { count: Number(count), retryAfterSeconds: Math.max(Number(ttl), 1) };
}

export async function clearAttempts(ip: string): Promise<void> {
  await redis().del(keyFor(ip));
}
