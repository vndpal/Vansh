import { describe, expect, it } from "vitest";
import { layoutTree, NODE_HEIGHT, NODE_WIDTH } from "./layout";
import { samplePeople } from "./sample-family";
import type { Person } from "./types";

const xOf = (people: Person[]) => {
  const x = new Map(layoutTree(people).nodes.map((n) => [n.id, n.position.x]));
  return (id: string) => x.get(id)!;
};

/** A few unrelated families over three generations whose children marry each other. */
function randomFamilies(seed: number): Person[] {
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const people: Person[] = [];
  const add = (p: Omit<Person, "id" | "spouseIds">) => {
    const person: Person = { ...p, id: `p${people.length}`, spouseIds: [] };
    people.push(person);
    return person;
  };
  const marry = (a: Person, b: Person) => {
    a.spouseIds.push(b.id);
    b.spouseIds.push(a.id);
  };
  for (let f = 0; f < 2 + Math.floor(rand() * 3); f++) {
    marry(add({ name: "M", gender: "male", birthYear: 1900 }), add({ name: "W", gender: "female", birthYear: 1902 }));
  }
  for (let gen = 0; gen < 3; gen++) {
    const fathers = people.filter((p) => p.gender === "male" && p.spouseIds.length && !people.some((c) => c.fatherId === p.id));
    for (const dad of fathers) {
      for (let k = 0; k < 1 + Math.floor(rand() * 3); k++) {
        const gender = rand() < 0.5 ? "male" : "female";
        add({ name: "C", gender, birthYear: 1930 + gen * 25 + Math.floor(rand() * 15), fatherId: dad.id, motherId: dad.spouseIds[0] });
      }
    }
    const single = people.filter((p) => p.spouseIds.length === 0 && p.fatherId);
    for (const man of single.filter((p) => p.gender === "male")) {
      const bride = single.find((w) => w.gender === "female" && w.fatherId !== man.fatherId && w.spouseIds.length === 0 && rand() < 0.7);
      marry(man, bride ?? add({ name: "B", gender: "female", birthYear: man.birthYear }));
    }
  }
  return people;
}

// Deterministic shuffle so a failure can be reproduced.
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

describe("layoutTree", () => {
  it("puts brothers and sisters in birth order, eldest on the left", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const x = xOf(shuffled(samplePeople, seed));
      expect(x("mohan")).toBeLessThan(x("gopal"));
      expect(x("suresh")).toBeLessThan(x("mahesh"));
      expect(x("ravi")).toBeLessThan(x("deepak"));
      expect(x("neha")).toBeLessThan(x("meera"));
    }
  });

  it("keeps each wife's children together, in birth order", () => {
    const x = xOf(samplePeople);
    expect(x("anita")).toBeLessThan(x("suresh"));
    expect(x("suresh")).toBeLessThan(x("usha"));
    expect(x("deepak")).toBeLessThan(x("asha"));
  });

  it("puts children without a birth year after the others", () => {
    const people: Person[] = [
      { id: "dad", name: "Dad", gender: "male", spouseIds: [] },
      { id: "c", name: "C", gender: "female", fatherId: "dad", spouseIds: [] },
      { id: "b", name: "B", gender: "male", birthYear: 1990, fatherId: "dad", spouseIds: [] },
      { id: "a", name: "A", gender: "male", birthYear: 1980, fatherId: "dad", spouseIds: [] },
    ];
    const x = xOf(people);
    expect(x("a")).toBeLessThan(x("b"));
    expect(x("b")).toBeLessThan(x("c"));
  });

  it("boxes each family line, with married daughters in their husband's box", () => {
    const people: Person[] = [
      ...samplePeople.map((p) => (p.id === "asha" ? { ...p, spouseIds: ["vivek"] } : p)),
      { id: "prakash", name: "Prakash", gender: "male", spouseIds: [] },
      { id: "vivek", name: "Vivek", gender: "male", fatherId: "prakash", spouseIds: ["asha"] },
    ];
    const { nodes, edges } = layoutTree(people);
    const boxes = nodes.filter((n) => n.type === "family");
    expect(boxes.map((b) => [b.id, b.data.label])).toEqual([
      ["f:hari", "Hari's vansh"],
      ["f:prakash", "Prakash's vansh"],
      ["f:sanjay", "Sanjay's vansh"],
    ]);

    const inside = (box: string, id: string) => {
      const b = nodes.find((n) => n.id === box)!;
      const p = nodes.find((n) => n.id === id)!;
      return p.position.x >= b.position.x && p.position.x + p.width! <= b.position.x + b.width! &&
        p.position.y >= b.position.y && p.position.y + p.height! <= b.position.y + b.height!;
    };
    for (const id of ["hari", "ravi", "priya", "neha", "tara"]) expect(inside("f:hari", id)).toBe(true);
    for (const id of ["prakash", "vivek", "asha"]) expect(inside("f:prakash", id)).toBe(true);
    expect(inside("f:hari", "asha")).toBe(false);

    // Lines into another family are dashed; lines within one are not.
    const dashed = (id: string) => "strokeDasharray" in (edges.find((e) => e.id === id)!.style ?? {});
    expect(dashed("c:asha")).toBe(true);
    expect(dashed("p:dinesh:neha")).toBe(true);
    expect(dashed("c:ravi")).toBe(false);
  });

  it("draws no boxes when everyone is in one family line", () => {
    const people: Person[] = [
      { id: "dad", name: "Dad", gender: "male", spouseIds: ["mum"] },
      { id: "mum", name: "Mum", gender: "female", spouseIds: ["dad"] },
      { id: "son", name: "Son", gender: "male", fatherId: "dad", motherId: "mum", spouseIds: [] },
    ];
    expect(layoutTree(people).nodes.some((n) => n.type === "family")).toBe(false);
  });

  it("lays out random intermarried families without errors or overlapping cards", () => {
    // Seeds 362, 369 and 445 make dagre's box support throw; the layout must fall back, not fail.
    for (const seed of [...Array(40).keys(), 362, 369, 445]) {
      const people = randomFamilies(seed);
      const cards = layoutTree(people).nodes.filter((n) => n.type === "person");
      expect(cards.length).toBe(people.length);
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const [a, b] = [cards[i].position, cards[j].position];
          expect(Math.abs(a.x - b.x) >= NODE_WIDTH || Math.abs(a.y - b.y) >= NODE_HEIGHT, `seed ${seed}`).toBe(true);
        }
      }
    }
  });

  it("marks fathers as family heads", () => {
    const heads = layoutTree(samplePeople)
      .nodes.filter((n) => n.type === "person" && n.data.isHead)
      .map((n) => n.id)
      .sort();
    expect(heads).toEqual(["dinesh", "gopal", "hari", "kiran", "mahesh", "mohan", "ravi", "suresh", "vijay"]);
  });
});
