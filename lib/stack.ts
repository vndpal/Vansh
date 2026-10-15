// Builds the stacked view: each family is its head with his wives, and his children
// nested underneath, oldest first. Pure, no I/O.
import { buildIndex, byBirthYear } from "./tree";
import type { Person } from "./types";

export interface StackFamily {
  head: Person;
  /** Oldest first. */
  spouses: Person[];
  /** Oldest first. */
  children: StackEntry[];
  /** Everyone shown in this block, nested families included. */
  ids: Set<string>;
}

export interface StackEntry {
  /** A child of the block above. */
  person: Person;
  /** Oldest first. */
  spouses: Person[];
  /** Their own family, or the family of the outside spouse they married into. */
  family?: StackFamily;
}

export interface Stack {
  families: StackFamily[];
  /** People who are not part of any family block. */
  others: StackEntry[];
}

export function buildStack(people: Person[]): Stack {
  const { byId } = buildIndex(people);
  const sorted = [...people].sort(byBirthYear);
  const spousesOf = (p: Person) =>
    p.spouseIds
      .map((id) => byId.get(id))
      .filter((s): s is Person => !!s && s.id !== p.id)
      .sort(byBirthYear);
  const hasParents = (p: Person) => [p.fatherId, p.motherId].some((id) => id && byId.has(id));

  // Each child sits in their father's block, or their mother's when no father is recorded.
  const childrenOf = new Map<string, Person[]>();
  for (const child of sorted) {
    const ownerId = [child.fatherId, child.motherId].find((id) => id && byId.has(id));
    if (ownerId) childrenOf.set(ownerId, [...(childrenOf.get(ownerId) ?? []), child]);
  }

  const built = new Set<string>();

  function family(head: Person): StackFamily {
    built.add(head.id);
    const spouses = spousesOf(head);
    const ids = new Set([head.id, ...spouses.map((s) => s.id)]);
    const children = (childrenOf.get(head.id) ?? []).map((child) => {
      const entry = entryFor(child);
      for (const id of entry.family?.ids ?? [child.id, ...entry.spouses.map((s) => s.id)]) ids.add(id);
      return entry;
    });
    return { head, spouses, children, ids };
  }

  function entryFor(child: Person): StackEntry {
    const spouses = spousesOf(child);
    if (childrenOf.has(child.id) && !built.has(child.id)) return { person: child, spouses, family: family(child) };
    // Married to someone with no parents in the tree: their family has no other home, so show it here.
    const outsider = spouses.find((s) => childrenOf.has(s.id) && !hasParents(s) && !built.has(s.id));
    if (outsider) return { person: child, spouses, family: family(outsider) };
    return { person: child, spouses };
  }

  // Top-level families start from heads with no parents in the tree. Those married to
  // someone who has parents wait, as that spouse's entry will usually pull them in.
  const families: StackFamily[] = [];
  const roots = sorted.filter((p) => childrenOf.has(p.id) && !hasParents(p));
  for (const p of roots) if (!built.has(p.id) && !spousesOf(p).some(hasParents)) families.push(family(p));
  for (const p of roots) if (!built.has(p.id)) families.push(family(p));

  const shown = new Set(families.flatMap((f) => [...f.ids]));
  const others: StackEntry[] = [];
  for (const person of sorted) {
    if (shown.has(person.id)) continue;
    const spouses = spousesOf(person);
    others.push({ person, spouses });
    for (const p of [person, ...spouses]) shown.add(p.id);
  }
  families.sort((a, b) => byBirthYear(a.head, b.head));
  return { families, others };
}
