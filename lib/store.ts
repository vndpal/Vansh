import { Redis } from "@upstash/redis";
import type { Person } from "./types";

const TREE_KEY = "family-tree";

let client: Redis | undefined;

export function redis(): Redis {
  if (client) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL and KV_REST_API_TOKEN).",
    );
  }
  // Values are read and written as raw strings so the compare-and-set below can compare them exactly.
  client = new Redis({ url, token, automaticDeserialization: false });
  return client;
}

function parse(raw: string | null): Person[] {
  if (!raw) return [];
  const data = JSON.parse(raw) as { people?: Person[] };
  return (data.people ?? []).map((p) => ({ ...p, spouseIds: Array.isArray(p.spouseIds) ? p.spouseIds : [] }));
}

export async function loadPeople(): Promise<Person[]> {
  return parse(await redis().get<string>(TREE_KEY));
}

export async function savePeople(people: Person[]): Promise<void> {
  await redis().set(TREE_KEY, JSON.stringify({ people }));
}

// Writes the new document only if nobody changed it since we read it.
const COMPARE_AND_SET = `
local current = redis.call('GET', KEYS[1])
if current == false then current = '' end
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

/** Reads the tree, applies `change`, and saves it, retrying if another save happened in between. */
export async function updatePeople(change: (people: Person[]) => Person[]): Promise<Person[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const raw = (await redis().get<string>(TREE_KEY)) ?? "";
    const next = change(parse(raw));
    const saved = await redis().eval(COMPARE_AND_SET, [TREE_KEY], [raw, JSON.stringify({ people: next })]);
    if (Number(saved) === 1) return next;
  }
  throw new Error("Someone else was saving at the same moment. Please try again.");
}
