// Everyone related to one person, grouped by side of the family, with what they are to
// that person. Pure functions, no I/O.
import { findRelationship } from "./kinship";
import { buildIndex, byBirthYear } from "./tree";
import type { Person } from "./types";

export type Side = "close" | "father" | "mother" | "siblings" | "spouse" | "children";

export const SIDE_TITLES: Record<Side, string> = {
  close: "Close family",
  father: "Father's side",
  mother: "Mother's side",
  siblings: "Brothers' and sisters' families",
  spouse: "In-laws (spouse's side)",
  children: "Children's families",
};

const SIDE_ORDER: Side[] = ["close", "father", "mother", "siblings", "spouse", "children"];

export interface Relative {
  person: Person;
  /** A Hindi word or phrase, else the English term, else the chain ("father's brother's wife"). */
  relation: string;
  /** The English term, when `relation` is something else. */
  term: string | null;
  /** Number of hops between the two people. */
  distance: number;
}

type Move = "up" | "down" | "spouse";

export function relativesOf(people: Person[], id: string): Array<{ side: Side; relatives: Relative[] }> {
  const index = buildIndex(people);
  const me = index.byId.get(id);
  if (!me) return [];

  const moveBetween = (from: string, to: string): Move => {
    const p = index.byId.get(from)!;
    if (p.fatherId === to || p.motherId === to) return "up";
    const q = index.byId.get(to)!;
    return q.fatherId === from || q.motherId === from ? "down" : "spouse";
  };

  const bySide = new Map<Side, Array<Relative & { rank: number }>>();
  for (const person of people) {
    if (person.id === id) continue;
    const r = findRelationship(people, id, person.id);
    if (!r.connected) continue;
    const moves = r.path.slice(1).map((to, i) => moveBetween(r.path[i], to));
    const [first, second] = moves;

    let side: Side;
    // Within close family: parents, then spouses, then brothers and sisters, then children.
    let rank = 0;
    if (moves.length === 1) {
      side = "close";
      rank = { up: 0, spouse: 1, down: 3 }[first];
    } else if (first === "up" && second === "down") {
      side = moves.length === 2 ? "close" : "siblings";
      rank = 2;
    } else if (first === "up") {
      side = index.byId.get(r.path[1])!.gender === "male" ? "father" : "mother";
    } else if (first === "spouse") {
      side = "spouse";
    } else {
      side = "children";
    }

    const relation = r.hindi ?? r.term ?? r.words.join("'s ");
    const list = bySide.get(side) ?? [];
    list.push({ person, relation, term: relation === r.term ? null : r.term, distance: moves.length, rank });
    bySide.set(side, list);
  }

  return SIDE_ORDER.filter((side) => bySide.has(side)).map((side) => ({
    side,
    relatives: bySide
      .get(side)!
      .sort((a, b) => a.rank - b.rank || a.distance - b.distance || byBirthYear(a.person, b.person))
      .map(({ rank: _rank, ...relative }) => relative),
  }));
}
