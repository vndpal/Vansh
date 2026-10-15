import { describe, expect, it } from "vitest";
import { layoutTree } from "./layout";
import { samplePeople } from "./sample-family";
import type { Person } from "./types";

const xOf = (people: Person[]) => {
  const x = new Map(layoutTree(people).nodes.map((n) => [n.id, n.position.x]));
  return (id: string) => x.get(id)!;
};

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

  it("marks fathers as family heads", () => {
    const heads = layoutTree(samplePeople)
      .nodes.filter((n) => n.type === "person" && n.data.isHead)
      .map((n) => n.id)
      .sort();
    expect(heads).toEqual(["dinesh", "gopal", "hari", "kiran", "mahesh", "mohan", "ravi", "suresh", "vijay"]);
  });
});
