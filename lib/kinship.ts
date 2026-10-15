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
      /** Hindi word such as "Chacha", or a phrase such as "Bhabhi ki Behen" when no single word fits. */
      hindi: string | null;
    };

export function findRelationship(people: Person[], fromId: string, toId: string): Relationship {
  const index = buildIndex(people);
  const route = findPath(index, fromId, toId);
  if (!route) return { connected: false };

  const from = index.byId.get(fromId)!;
  const to = index.byId.get(toId)!;
  if (fromId === toId) {
    return { connected: true, path: [fromId], words: [], chain: from.name, sentence: "That is the same person", term: null, hindi: null };
  }

  const words = describeSteps(index, route.ids, route.moves);
  return {
    connected: true,
    path: route.ids,
    words,
    chain: [from.name, ...words, to.name].join(" → "),
    sentence: `${to.name} is ${from.name}'s ${words.join("'s ")}`,
    term: kinshipTerm(index, route.ids, route.moves),
    hindi: hindiTerm(index, route.ids, route.moves),
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

/**
 * A blood part of a path: `up` generations to the nearest common ancestor, then
 * `down` generations to the end. A shortest path between blood relatives always
 * turns at their nearest common ancestor.
 */
interface Segment {
  ids: string[];
  up: number;
  down: number;
}

/**
 * Splits a path at marriages, e.g. shape "BS" for a blood relative's spouse.
 * Null when a blood part is not a plain up-then-down line.
 */
function splitAtMarriages(ids: string[], moves: Move[]): { shape: string; segments: Segment[] } | null {
  const segments: Segment[] = [];
  let shape = "";
  let start = 0;
  for (let i = 0; i <= moves.length; i++) {
    if (i < moves.length && moves[i] !== "spouse") continue;
    if (i > start) {
      const part = moves.slice(start, i);
      const up = part.filter((m) => m === "up").length;
      if (part.slice(0, up).some((m) => m !== "up")) return null;
      segments.push({ ids: ids.slice(start, i + 1), up, down: part.length - up });
      shape += "B";
    }
    if (i < moves.length) shape += "S";
    start = i + 1;
  }
  return { shape, segments };
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

/** Matches the path's shape against the standard English terms. Returns null when no term fits. */
function kinshipTerm(index: FamilyIndex, ids: string[], moves: Move[]): string | null {
  const split = splitAtMarriages(ids, moves);
  if (!split) return null;

  const a = index.byId.get(ids[0])!;
  const b = index.byId.get(ids[ids.length - 1])!;
  const g = b.gender;
  const [r] = split.segments;

  switch (split.shape) {
    case "S":
      return byGender(g, "husband", "wife");
    case "B":
      return bloodTerm(r.up, r.down, g, r.up === 1 && r.down === 1 && isHalfSibling(a, b));
    case "SB":
      // B is a blood relative of A's spouse.
      if (r.down === 0) return `${bloodTerm(r.up, 0, g)}-in-law`;
      if (r.up === 0) return stepTerm(bloodTerm(0, r.down, g), r.down);
      if (r.up === 1 && r.down === 1) return siblingInLaw(g);
      return `${bloodTerm(r.up, r.down, g)} by marriage`;
    case "BS":
      // B is the spouse of A's blood relative.
      if (r.up === 0) return `${bloodTerm(0, r.down, g)}-in-law`;
      if (r.down === 0) return stepTerm(bloodTerm(r.up, 0, g), r.up);
      if (r.up === 1 && r.down === 1) return siblingInLaw(g);
      return `${bloodTerm(r.up, r.down, g)} by marriage`;
    case "SBS":
      // Spouse's sibling's spouse.
      return r.up === 1 && r.down === 1 ? siblingInLaw(g) : null;
    default:
      return null;
  }
}

// Hindi words (romanised). Many depend on the side of the family (Chacha vs Mama),
// on who is older (Tau vs Chacha, Jeth vs Devar) and on the speaker's gender (Saala vs Devar).

/** Elder or younger word by birth year. Both, when a year is missing or the years are equal. */
function byAge(person: Person, than: Person, elder: string, younger: string): string {
  if (person.birthYear === undefined || than.birthYear === undefined || person.birthYear === than.birthYear) {
    return `${younger} or ${elder}`;
  }
  return person.birthYear < than.birthYear ? elder : younger;
}

/** Word for someone of A's parent's generation, or their spouse (`byMarriage`). */
function uncleWord(parent: Person, relative: Person, byMarriage: boolean): string {
  if (parent.gender === "female") {
    if (byMarriage) return relative.gender === "male" ? "Mami" : "Mausa";
    return byGender(relative.gender, "Mama", "Mausi");
  }
  if (relative.gender === "female") return byMarriage ? "Phupha" : "Bua";
  return byMarriage ? byAge(relative, parent, "Tai", "Chachi") : byAge(relative, parent, "Tau", "Chacha");
}

function hindiBlood(index: FamilyIndex, { ids, up, down }: Segment): string | null {
  const at = (i: number) => index.byId.get(ids.at(i)!)!;
  const a = at(0);
  const b = at(-1);
  const g = b.gender;
  // A's parent on the way up, or A's child when B is a direct descendant.
  const viaMale = at(1).gender === "male";
  const grandparent = viaMale ? byGender(g, "Dada", "Dadi") : byGender(g, "Nana", "Nani");
  const grandchild = viaMale ? byGender(g, "Pota", "Poti") : byGender(g, "Nati", "Natin");

  switch (down - up) {
    case 0:
      if (up === 1) return isHalfSibling(a, b) ? byGender(g, "Sautela Bhai", "Sauteli Behen") : byGender(g, "Bhai", "Behen");
      // Cousins of any degree, named after A's parent's side and B's parent.
      return `${viaMale ? (at(-2).gender === "male" ? "Chacher" : "Phupher") : at(-2).gender === "male" ? "Mamer" : "Mauser"}${byGender(g, "a Bhai", "i Behen")}`;
    case -1:
      return down === 0 ? byGender(g, "Pita", "Mata") : uncleWord(at(1), b, false);
    case 1:
      if (up === 0) return byGender(g, "Beta", "Beti");
      return at(-2).gender === "male" ? byGender(g, "Bhatija", "Bhatiji") : byGender(g, "Bhanja", "Bhanji");
    case -2:
      return down === 0 ? grandparent : null;
    case -3:
      return down === 0 ? `Par${grandparent.toLowerCase()}` : null;
    case 2:
      return up === 0 ? grandchild : null;
    case 3:
      return up === 0 ? `Par${grandchild.toLowerCase()}` : null;
    default:
      return null;
  }
}

/** A single Hindi word for the whole path, or null when none fits. */
function hindiWord(index: FamilyIndex, ids: string[], moves: Move[]): string | null {
  const split = splitAtMarriages(ids, moves);
  if (!split) return null;

  const at = (i: number) => index.byId.get(ids.at(i)!)!;
  const a = at(0);
  const b = at(-1);
  const g = b.gender;
  const [r, r2] = split.segments;

  switch (split.shape) {
    case "S":
      return byGender(g, "Pati", "Patni");
    case "B":
      return hindiBlood(index, r);
    case "SB": {
      // B is a blood relative of A's spouse (at 1).
      if (r.up === 1 && r.down === 0) return byGender(g, "Sasur", "Saas");
      if (r.up === 0 && r.down === 1) return byGender(g, "Sautela Beta", "Sauteli Beti");
      const generation = r.down - r.up;
      // The spouse's brothers and sisters, cousins included, as with Bhabhi and Jija below.
      if (generation === 0) {
        if (a.gender === "male") return byGender(g, "Saala", "Saali");
        return g === "female" ? "Nanad" : byAge(b, at(1), "Jeth", "Devar");
      }
      // Their children, named after B's parent as with A's own Bhatija and Bhanja.
      if (generation === 1) return at(-2).gender === "male" ? byGender(g, "Bhatija", "Bhatiji") : byGender(g, "Bhanja", "Bhanji");
      return null;
    }
    case "BS": {
      // B is the spouse of A's blood relative (at -2).
      if (r.up === 1 && r.down === 0) return byGender(g, "Sautela Pita", "Sauteli Maa");
      const generation = r.down - r.up;
      if (generation === 0) return byGender(g, "Jija", "Bhabhi");
      if (generation === 1) return byGender(g, "Damaad", "Bahu");
      if (generation === -1) return uncleWord(at(1), at(-2), true);
      return null;
    }
    case "SBS": {
      // Spouse's sibling's (or cousin's) spouse.
      if (r.up === 0 || r.down !== r.up) return null;
      const sibling = at(-2);
      if (a.gender === "male") return sibling.gender === "female" ? "Saadhu" : "Salhaj";
      return sibling.gender === "female" ? "Nandoi" : byAge(sibling, at(1), "Jethani", "Devrani");
    }
    case "BSB":
      // Child's spouse's parent.
      return r.up === 0 && r.down === 1 && r2.up === 1 && r2.down === 0 ? byGender(g, "Samdhi", "Samdhan") : null;
    default:
      return null;
  }
}

// Words that change before ka/ki/ke: "Beta" becomes "Bete ki Patni".
const OBLIQUE = new Set(["Beta", "Bhatija", "Bhanja", "Pota", "Parpota", "Saala", "Sautela", "Chachera", "Phuphera", "Mamera", "Mausera"]);
const oblique = (phrase: string) =>
  phrase
    .split(" ")
    .map((w) => (OBLIQUE.has(w) ? `${w.slice(0, -1)}e` : w))
    .join(" ");

/**
 * The Hindi word for B, or a phrase like "Bhabhi ki Behen" built from words for
 * parts of the path. A part never ends at the top of a sibling step (so it reads
 * "Dada ka Bhai", not "Pardada ka Beta"), and a part that ends right after a
 * marriage is preferred, the way people say "Bhabhi ka Bhai".
 */
function hindiTerm(index: FamilyIndex, ids: string[], moves: Move[]): string | null {
  const parts: Array<{ word: string; person: Person; elder: boolean }> = [];
  for (let i = 0; i < moves.length; ) {
    const options: Array<{ end: number; word: string }> = [];
    for (let end = moves.length; end > i; end--) {
      if (end < moves.length && moves[end - 1] === "up" && moves[end] === "down") continue;
      const word = hindiWord(index, ids.slice(i, end + 1), moves.slice(i, end));
      if (word) options.push({ end, word });
    }
    const pick = options[0]?.end === moves.length ? options[0] : (options.find((o) => moves[o.end - 1] === "spouse") ?? options[0]);
    if (!pick) return null;
    const hops = moves.slice(i, pick.end);
    parts.push({
      word: pick.word,
      person: index.byId.get(ids[pick.end])!,
      elder: hops.filter((m) => m === "up").length > hops.filter((m) => m === "down").length,
    });
    i = pick.end;
  }

  return parts
    .map((part, k) => {
      const next = parts[k + 1];
      if (!next) return part.word;
      const of = next.person.gender === "female" ? "ki" : next.elder ? "ke" : "ka";
      return `${oblique(part.word)} ${of}`;
    })
    .join(" ");
}
