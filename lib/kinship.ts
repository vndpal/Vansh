// Relationship finder. Pure functions over a list of people, no I/O.
import type { Gender, Person } from "./types";
import { buildIndex, type FamilyIndex } from "./tree";

type Move = "up" | "down" | "spouse";

export type Relationship =
  | { connected: false }
  | {
      connected: true;
      /** Person ids from A to B, inclusive. */
      path: string[];
      /** Plain words for each hop, e.g. ["father", "brother", "son"]. */
      words: string[];
      /** "Ravi → father → brother → Meera" */
      chain: string;
      /** "Meera is Ravi's father's brother" */
      sentence: string;
      /** Standard English kinship term, or null when none fits. */
      term: string | null;
    };

export function findRelationship(people: Person[], fromId: string, toId: string): Relationship {
  const index = buildIndex(people);
  const route = findPath(index, fromId, toId);
  if (!route) return { connected: false };

  const from = index.byId.get(fromId)!;
  const to = index.byId.get(toId)!;
  if (fromId === toId) {
    return { connected: true, path: [fromId], words: [], chain: from.name, sentence: "That is the same person", term: null };
  }

  const words = describeSteps(index, route.ids, route.moves);
  return {
    connected: true,
    path: route.ids,
    words,
    chain: [from.name, ...words, to.name].join(" → "),
    sentence: `${to.name} is ${from.name}'s ${words.join("'s ")}`,
    term: kinshipTerm(index, route.ids, route.moves),
  };
}

function neighbors(index: FamilyIndex, id: string): Array<[string, Move]> {
  const person = index.byId.get(id)!;
  const result: Array<[string, Move]> = [];
  for (const parentId of [person.fatherId, person.motherId]) {
    if (parentId && index.byId.has(parentId)) result.push([parentId, "up"]);
  }
  for (const childId of index.childrenOf.get(id) ?? []) result.push([childId, "down"]);
  for (const spouseId of person.spouseIds) {
    if (spouseId !== id && index.byId.has(spouseId)) result.push([spouseId, "spouse"]);
  }
  return result;
}

/**
 * BFS over parent, child and spouse edges. Returns a shortest path; among
 * shortest paths it picks the one that goes through the fewest marriages.
 */
export function findPath(index: FamilyIndex, fromId: string, toId: string): { ids: string[]; moves: Move[] } | null {
  if (!index.byId.has(fromId) || !index.byId.has(toId)) return null;

  const dist = new Map([[fromId, 0]]);
  const marriages = new Map([[fromId, 0]]);
  const prev = new Map<string, { id: string; move: Move }>();
  const queue = [fromId];

  // Every node at depth d is expanded before any node at depth d + 1, so by the
  // time a node is expanded its marriage count is final.
  for (let i = 0; i < queue.length && queue[i] !== toId; i++) {
    const id = queue[i];
    const d = dist.get(id)! + 1;
    for (const [next, move] of neighbors(index, id)) {
      const m = marriages.get(id)! + (move === "spouse" ? 1 : 0);
      const known = dist.get(next);
      if (known === undefined) {
        dist.set(next, d);
        marriages.set(next, m);
        prev.set(next, { id, move });
        queue.push(next);
      } else if (known === d && m < marriages.get(next)!) {
        marriages.set(next, m);
        prev.set(next, { id, move });
      }
    }
  }
  if (!dist.has(toId)) return null;

  const ids = [toId];
  const moves: Move[] = [];
  for (let at = toId; at !== fromId; ) {
    const step = prev.get(at)!;
    ids.unshift(step.id);
    moves.unshift(step.move);
    at = step.id;
  }
  return { ids, moves };
}

export function isHalfSibling(a: Person, b: Person): boolean {
  const sameFather = !!a.fatherId && a.fatherId === b.fatherId;
  const sameMother = !!a.motherId && a.motherId === b.motherId;
  if (sameFather && sameMother) return false;
  // Only call it "half" when the other parent is known on both sides and differs.
  if (sameFather) return !!a.motherId && !!b.motherId;
  if (sameMother) return !!a.fatherId && !!b.fatherId;
  return false;
}

const byGender = (gender: Gender, male: string, female: string) => (gender === "male" ? male : female);

function siblingWord(a: Person, b: Person): string {
  return (isHalfSibling(a, b) ? "half-" : "") + byGender(b.gender, "brother", "sister");
}

/** Turns hops into words. A parent hop followed by a child hop reads as a sibling. */
function describeSteps(index: FamilyIndex, ids: string[], moves: Move[]): string[] {
  const words: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (moves[i] === "up" && moves[i + 1] === "down") {
      words.push(siblingWord(index.byId.get(ids[i])!, index.byId.get(ids[i + 2])!));
      i++;
      continue;
    }
    const g = index.byId.get(ids[i + 1])!.gender;
    if (moves[i] === "up") words.push(byGender(g, "father", "mother"));
    else if (moves[i] === "down") words.push(byGender(g, "son", "daughter"));
    else words.push(byGender(g, "husband", "wife"));
  }
  return words;
}

/** Generations from a person up to each of their ancestors (self at 0). */
function ancestorDepths(index: FamilyIndex, id: string): Map<string, number> {
  const depths = new Map([[id, 0]]);
  const queue = [id];
  for (let i = 0; i < queue.length; i++) {
    const person = index.byId.get(queue[i])!;
    for (const parentId of [person.fatherId, person.motherId]) {
      if (parentId && index.byId.has(parentId) && !depths.has(parentId)) {
        depths.set(parentId, depths.get(queue[i])! + 1);
        queue.push(parentId);
      }
    }
  }
  return depths;
}

/**
 * Blood relationship through the nearest common ancestor: `up` generations from
 * A to that ancestor and `down` generations from it to B. Null if none.
 */
export function bloodRelation(index: FamilyIndex, aId: string, bId: string): { up: number; down: number } | null {
  const fromA = ancestorDepths(index, aId);
  const fromB = ancestorDepths(index, bId);
  let best: { up: number; down: number } | null = null;
  for (const [id, up] of fromA) {
    const down = fromB.get(id);
    if (down !== undefined && (!best || up + down < best.up + best.down)) best = { up, down };
  }
  return best;
}

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

function ordinal(n: number): string {
  if (n <= ORDINALS.length) return ORDINALS[n - 1];
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function greats(n: number): string {
  if (n <= 0) return "";
  return n <= 2 ? "great-".repeat(n) : `${n}x great-`;
}

/** Term for B where B is `up` generations above the common ancestor's line from A and `down` below it. */
export function bloodTerm(up: number, down: number, gender: Gender, half = false): string {
  if (up === 0 && down === 0) return "self";
  if (up === 0) {
    const base = byGender(gender, "son", "daughter");
    return down === 1 ? base : `${greats(down - 2)}grand${base}`;
  }
  if (down === 0) {
    const base = byGender(gender, "father", "mother");
    return up === 1 ? base : `${greats(up - 2)}grand${base}`;
  }
  if (up === 1 && down === 1) return (half ? "half-" : "") + byGender(gender, "brother", "sister");
  if (down === 1) return greats(up - 2) + byGender(gender, "uncle", "aunt");
  if (up === 1) return greats(down - 2) + byGender(gender, "nephew", "niece");

  const removed = Math.abs(up - down);
  const removedText = removed === 0 ? "" : removed === 1 ? " once removed" : removed === 2 ? " twice removed" : ` ${removed} times removed`;
  return `${ordinal(Math.min(up, down) - 1)} cousin${removedText}`;
}

const stepTerm = (term: string, generations: number) => (generations === 1 ? `step${term}` : `step-${term}`);
const siblingInLaw = (gender: Gender) => byGender(gender, "brother-in-law", "sister-in-law");

function isUpThenDown(moves: Move[]): boolean {
  let goingDown = false;
  for (const move of moves) {
    if (move === "down") goingDown = true;
    else if (goingDown) return false;
  }
  return true;
}

/**
 * Splits the path at marriages into blood segments and matches the shape
 * against the standard English terms. Returns null when no term fits.
 */
function kinshipTerm(index: FamilyIndex, ids: string[], moves: Move[]): string | null {
  const segments: Array<{ from: string; to: string }> = [];
  let shape = "";
  let start = 0;
  for (let i = 0; i <= moves.length; i++) {
    if (i < moves.length && moves[i] !== "spouse") continue;
    if (i > start) {
      if (!isUpThenDown(moves.slice(start, i))) return null;
      segments.push({ from: ids[start], to: ids[i] });
      shape += "B";
    }
    if (i < moves.length) shape += "S";
    start = i + 1;
  }

  const a = index.byId.get(ids[0])!;
  const b = index.byId.get(ids[ids.length - 1])!;
  const g = b.gender;
  const rel = (n: number) => bloodRelation(index, segments[n].from, segments[n].to)!;

  switch (shape) {
    case "S":
      return byGender(g, "husband", "wife");
    case "B": {
      const r = rel(0);
      return bloodTerm(r.up, r.down, g, r.up === 1 && r.down === 1 && isHalfSibling(a, b));
    }
    case "SB": {
      // B is a blood relative of A's spouse.
      const r = rel(0);
      if (r.down === 0) return `${bloodTerm(r.up, 0, g)}-in-law`;
      if (r.up === 0) return stepTerm(bloodTerm(0, r.down, g), r.down);
      if (r.up === 1 && r.down === 1) return siblingInLaw(g);
      return `${bloodTerm(r.up, r.down, g)} by marriage`;
    }
    case "BS": {
      // B is the spouse of A's blood relative.
      const r = rel(0);
      if (r.up === 0) return `${bloodTerm(0, r.down, g)}-in-law`;
      if (r.down === 0) return stepTerm(bloodTerm(r.up, 0, g), r.up);
      if (r.up === 1 && r.down === 1) return siblingInLaw(g);
      return `${bloodTerm(r.up, r.down, g)} by marriage`;
    }
    case "SBS": {
      // Spouse's sibling's spouse.
      const r = rel(0);
      return r.up === 1 && r.down === 1 ? siblingInLaw(g) : null;
    }
    default:
      return null;
  }
}
