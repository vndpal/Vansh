// In-law families: the birth family of someone who married into the tree, such as a
// son's wife's parents and brothers, or a daughter's husband's family. The tree folds
// them away by default and opens them one at a time from the person who married in.
// Pure functions, no I/O.
import { buildIndex, byBirthYear, descendantIds } from "./tree";
import type { Person } from "./types";

export interface InLawFamilies {
  /** Always shown: the main family by blood with their husbands and wives, and anyone unconnected. */
  main: string[];
  /** Someone who married in -> the people that opening their family shows. */
  families: Map<string, string[]>;
  /** Each person in an in-law family -> the person who married in whose family it is. */
  openedBy: Map<string, string>;
}

export function inLawFamilies(people: Person[]): InLawFamilies {
  const index = buildIndex(people);
  const { byId } = index;
  const parentsOf = (id: string) => {
    const p = byId.get(id)!;
    return [p.fatherId, p.motherId].filter((x): x is string => !!x && byId.has(x));
  };
  const spousesOf = (id: string) => byId.get(id)!.spouseIds.filter((s) => s !== id && byId.has(s));

  // Everyone sharing an ancestor with `id`, oldest first.
  const bloodOf = (id: string) => {
    const ancestors = [id];
    for (let i = 0; i < ancestors.length; i++) {
      for (const parent of parentsOf(ancestors[i])) if (!ancestors.includes(parent)) ancestors.push(parent);
    }
    const blood = new Set(ancestors);
    for (const a of ancestors) for (const d of descendantIds(index, a)) blood.add(d);
    return [...blood].map((b) => byId.get(b)!).sort(byBirthYear).map((p) => p.id);
  };

  const placed = new Set<string>();
  // Places a blood family and their spouses. Returns who was placed, and the spouses,
  // who married in and may bring families of their own.
  const place = (id: string) => {
    const ids: string[] = [];
    const marriedIn: string[] = [];
    const blood = bloodOf(id);
    for (const b of blood) {
      if (!placed.has(b)) {
        placed.add(b);
        ids.push(b);
      }
    }
    for (const b of blood) {
      for (const s of spousesOf(b)) {
        if (!placed.has(s)) {
          placed.add(s);
          ids.push(s);
          marriedIn.push(s);
        }
      }
    }
    return { ids, marriedIn };
  };

  // The main family starts from the founder with the most descendants (a man before his wife).
  const founders = people
    .filter((p) => parentsOf(p.id).length === 0)
    .map((p) => ({ p, descendants: descendantIds(index, p.id).size }))
    .sort((a, b) => b.descendants - a.descendants || (a.p.gender === b.p.gender ? byBirthYear(a.p, b.p) : a.p.gender === "male" ? -1 : 1));
  const families = new Map<string, string[]>();
  const openedBy = new Map<string, string>();
  if (founders.length === 0) return { main: people.map((p) => p.id), families, openedBy };

  const start = place(founders[0].p.id);
  const main = start.ids;
  const queue = start.marriedIn;
  for (let i = 0; i < queue.length; i++) {
    const { ids, marriedIn } = place(queue[i]);
    if (ids.length === 0) continue;
    families.set(queue[i], ids);
    for (const id of ids) openedBy.set(id, queue[i]);
    queue.push(...marriedIn);
  }
  // People not connected to the main family are their own trees; always show them.
  for (const p of people) if (!placed.has(p.id)) main.push(p.id);
  return { main, families, openedBy };
}

/** Everyone shown when the families of the people in `open` are opened. */
export function shownPeople(inLaws: InLawFamilies, open: Set<string>): Set<string> {
  const shown = new Set<string>();
  const show = (ids: string[]) => {
    for (const id of ids) shown.add(id);
    for (const id of ids) if (open.has(id) && inLaws.families.has(id)) show(inLaws.families.get(id)!);
  };
  show(inLaws.main);
  return shown;
}

/** `open` plus whatever must also be opened for all of `ids` to be shown (`open` itself if nothing). */
export function openFor(inLaws: InLawFamilies, open: Set<string>, ids: Iterable<string>): Set<string> {
  const next = new Set(open);
  for (const id of ids) for (let by = inLaws.openedBy.get(id); by; by = inLaws.openedBy.get(by)) next.add(by);
  return next.size === open.size ? open : next;
}
