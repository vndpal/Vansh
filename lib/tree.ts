// Pure helpers for reading and changing the list of people. No I/O.
import type { Person } from "./types";

export class TreeError extends Error {}

export interface FamilyIndex {
  byId: Map<string, Person>;
  childrenOf: Map<string, string[]>;
}

export function buildIndex(people: Person[]): FamilyIndex {
  const byId = new Map(people.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  for (const p of people) {
    for (const parentId of [p.fatherId, p.motherId]) {
      if (!parentId || !byId.has(parentId)) continue;
      const list = childrenOf.get(parentId) ?? [];
      list.push(p.id);
      childrenOf.set(parentId, list);
    }
  }
  return { byId, childrenOf };
}

export function descendantIds(index: FamilyIndex, id: string): Set<string> {
  const found = new Set<string>();
  const stack = [id];
  while (stack.length) {
    for (const child of index.childrenOf.get(stack.pop()!) ?? []) {
      if (!found.has(child)) {
        found.add(child);
        stack.push(child);
      }
    }
  }
  return found;
}

/** Sort comparator: oldest first, people without a birth year last, ties keep their order. */
export function byBirthYear(a: Person, b: Person): number {
  // Infinity - Infinity is NaN, which `|| 0` turns into a tie.
  return (a.birthYear ?? Infinity) - (b.birthYear ?? Infinity) || 0;
}

/** A family head is a man with at least one child in the tree. */
export function isFamilyHead(index: FamilyIndex, id: string): boolean {
  return index.byId.get(id)?.gender === "male" && (index.childrenOf.get(id)?.length ?? 0) > 0;
}

/** Ids of a head's family: him, then his wives, then his children, each group oldest first. */
export function familyOf(index: FamilyIndex, headId: string): string[] {
  const sorted = (ids: string[]) =>
    ids
      .map((id) => index.byId.get(id))
      .filter((p): p is Person => !!p && p.id !== headId)
      .sort(byBirthYear)
      .map((p) => p.id);
  const head = index.byId.get(headId);
  if (!head) return [];
  return [headId, ...sorted(head.spouseIds), ...sorted(index.childrenOf.get(headId) ?? [])];
}

/** Ids of a person and their close family: parents, spouses, brothers and sisters, children. */
export function closeFamilyOf(index: FamilyIndex, id: string): string[] {
  const person = index.byId.get(id);
  if (!person) return [];
  const parents = [person.fatherId, person.motherId].filter((p): p is string => !!p && index.byId.has(p));
  const siblings = parents.flatMap((p) => index.childrenOf.get(p) ?? []);
  const children = index.childrenOf.get(id) ?? [];
  return [...new Set([id, ...parents, ...person.spouseIds.filter((s) => index.byId.has(s)), ...siblings, ...children])];
}

export type PersonInput = Omit<Person, "id">;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Drops undefined fields so the stored JSON stays tidy.
function clean(person: Person): Person {
  return Object.fromEntries(Object.entries(person).filter(([, v]) => v !== undefined)) as unknown as Person;
}

export function parsePersonInput(body: unknown): PersonInput {
  if (!body || typeof body !== "object") throw new TreeError("Invalid request.");
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) throw new TreeError("Name is required.");
  if (name.length > 100) throw new TreeError("Name is too long (100 characters max).");
  const nickname = optionalString(b.nickname);
  if (nickname && nickname.length > 50) throw new TreeError("Nickname is too long (50 characters max).");
  if (b.gender !== "male" && b.gender !== "female") throw new TreeError("Gender must be male or female.");

  let birthYear: number | undefined;
  if (b.birthYear !== undefined && b.birthYear !== null && b.birthYear !== "") {
    birthYear = Number(b.birthYear);
    if (!Number.isInteger(birthYear) || birthYear < 1 || birthYear > 9999) {
      throw new TreeError("Birth year must be a whole number like 1984.");
    }
  }

  const notes = optionalString(b.notes);
  if (notes && notes.length > 2000) throw new TreeError("Notes are too long (2000 characters max).");

  const spouseIds = Array.isArray(b.spouseIds)
    ? [...new Set(b.spouseIds.filter((s): s is string => typeof s === "string" && s !== ""))]
    : [];

  return {
    name,
    nickname,
    gender: b.gender,
    birthYear,
    notes,
    fatherId: optionalString(b.fatherId),
    motherId: optionalString(b.motherId),
    spouseIds,
  };
}

/** Creates or updates a person, validating links and keeping spouse links two-way. */
export function upsertPerson(people: Person[], id: string, input: PersonInput, create: boolean): Person[] {
  const index = buildIndex(people);
  const existing = index.byId.get(id);
  if (create && existing) throw new TreeError("That id is already in use.");
  if (!create && !existing) throw new TreeError("This person no longer exists.");

  const descendants = create ? new Set<string>() : descendantIds(index, id);
  const checkParent = (parentId: string | undefined, gender: Person["gender"], role: string) => {
    if (!parentId) return;
    const parent = index.byId.get(parentId);
    if (!parent) throw new TreeError(`The selected ${role} no longer exists.`);
    if (parentId === id) throw new TreeError(`A person cannot be their own ${role}.`);
    if (parent.gender !== gender) throw new TreeError(`${parent.name} is ${parent.gender} and cannot be set as ${role}.`);
    if (descendants.has(parentId)) {
      throw new TreeError(`${parent.name} is a descendant of ${input.name}, so this would make ${input.name} their own ancestor.`);
    }
  };
  checkParent(input.fatherId, "male", "father");
  checkParent(input.motherId, "female", "mother");

  for (const spouseId of input.spouseIds) {
    if (spouseId === id) throw new TreeError("A person cannot be their own spouse.");
    if (!index.byId.has(spouseId)) throw new TreeError("A selected spouse no longer exists.");
  }

  if (existing && existing.gender !== input.gender) {
    const role = existing.gender === "male" ? "father" : "mother";
    const child = people.find((p) => (role === "father" ? p.fatherId : p.motherId) === id);
    if (child) {
      throw new TreeError(`${existing.name} is set as the ${role} of ${child.name}. Remove that link before changing gender.`);
    }
  }

  const person = clean({ id, ...input });
  const spouses = new Set(input.spouseIds);
  const next = people.map((p) => {
    if (p.id === id) return person;
    const linked = p.spouseIds.includes(id);
    if (spouses.has(p.id) && !linked) return { ...p, spouseIds: [...p.spouseIds, id] };
    if (!spouses.has(p.id) && linked) return { ...p, spouseIds: p.spouseIds.filter((s) => s !== id) };
    return p;
  });
  return create ? [...next, person] : next;
}

/** Removes a person and every link that points to them. */
export function deletePerson(people: Person[], id: string): Person[] {
  if (!people.some((p) => p.id === id)) throw new TreeError("This person no longer exists.");
  return people
    .filter((p) => p.id !== id)
    .map((p) =>
      p.fatherId !== id && p.motherId !== id && !p.spouseIds.includes(id)
        ? p
        : clean({
            ...p,
            fatherId: p.fatherId === id ? undefined : p.fatherId,
            motherId: p.motherId === id ? undefined : p.motherId,
            spouseIds: p.spouseIds.filter((s) => s !== id),
          }),
    );
}
