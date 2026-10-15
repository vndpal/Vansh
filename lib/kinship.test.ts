import { describe, expect, it } from "vitest";
import { bloodTerm, findRelationship } from "./kinship";
import { samplePeople } from "./sample-family";

function relate(a: string, b: string) {
  const result = findRelationship(samplePeople, a, b);
  if (!result.connected) throw new Error(`${a} and ${b} are not connected`);
  return result;
}

describe("findRelationship", () => {
  it("finds siblings", () => {
    const r = relate("ravi", "deepak");
    expect(r.sentence).toBe("Deepak is Ravi's brother");
    expect(r.term).toBe("brother");
  });

  it("finds half-siblings", () => {
    const r = relate("ravi", "asha");
    expect(r.sentence).toBe("Asha is Ravi's half-sister");
    expect(r.term).toBe("half-sister");
  });

  it("finds an uncle", () => {
    const r = relate("ravi", "mahesh");
    expect(r.sentence).toBe("Mahesh is Ravi's father's brother");
    expect(r.term).toBe("uncle");
    expect(relate("mahesh", "ravi").term).toBe("nephew");
  });

  it("finds a great-uncle", () => {
    expect(relate("ravi", "gopal").term).toBe("great-uncle");
  });

  it("finds a first cousin", () => {
    const r = relate("ravi", "arjun");
    expect(r.sentence).toBe("Arjun is Ravi's father's brother's son");
    expect(r.term).toBe("first cousin");
  });

  it("finds a second cousin", () => {
    expect(relate("ravi", "kiran").term).toBe("second cousin");
  });

  it("finds a second cousin once removed, in both directions", () => {
    expect(relate("ravi", "tara").term).toBe("second cousin once removed");
    expect(relate("tara", "ravi").term).toBe("second cousin once removed");
  });

  it("finds a third cousin", () => {
    const r = relate("rohan", "tara");
    expect(r.sentence).toBe("Tara is Rohan's father's father's father's brother's son's son's daughter");
    expect(r.term).toBe("third cousin");
  });

  it("finds a great-grandparent and the reverse", () => {
    const r = relate("ravi", "hari");
    expect(r.sentence).toBe("Hari is Ravi's father's father's father");
    expect(r.term).toBe("great-grandfather");
    expect(relate("rohan", "kamala").term).toBe("great-great-grandmother");
    expect(relate("hari", "ravi").term).toBe("great-grandson");
  });

  it("finds a sister-in-law through a spouse and a brother-in-law through a sibling", () => {
    const r = relate("arjun", "meera");
    expect(r.sentence).toBe("Meera is Arjun's wife's sister");
    expect(r.term).toBe("sister-in-law");
    expect(relate("priya", "asha").term).toBe("sister-in-law");
    expect(relate("meera", "arjun").term).toBe("brother-in-law");
  });

  it("finds spouses, parents-in-law and children-in-law", () => {
    expect(relate("ravi", "priya").term).toBe("wife");
    expect(relate("priya", "suresh").term).toBe("father-in-law");
    expect(relate("suresh", "priya").term).toBe("daughter-in-law");
    expect(relate("dinesh", "arjun").term).toBe("son-in-law");
  });

  it("finds step-relations", () => {
    expect(relate("ravi", "usha").term).toBe("stepmother");
    expect(relate("usha", "ravi").term).toBe("stepson");
  });

  it("describes a chain through one marriage without a standard term", () => {
    const r = relate("ravi", "meera");
    expect(r.chain).toBe("Ravi → father → brother → son → wife → sister → Meera");
    expect(r.sentence).toBe("Meera is Ravi's father's brother's son's wife's sister");
    expect(r.term).toBeNull();
  });

  it("describes a chain through two marriages", () => {
    const r = relate("ravi", "sanjay");
    expect(r.words).toEqual(["father", "brother", "son", "wife", "sister", "husband"]);
    expect(r.sentence).toBe("Sanjay is Ravi's father's brother's son's wife's sister's husband");
    expect(r.term).toBeNull();
    expect(r.path).toEqual(["ravi", "suresh", "mohan", "mahesh", "arjun", "neha", "dinesh", "meera", "sanjay"]);
  });

  it("reports unconnected people", () => {
    expect(findRelationship(samplePeople, "ravi", "vikram")).toEqual({ connected: false });
  });

  it("prefers the shortest path, then the one with fewer marriages", () => {
    // Sister-in-law (3 hops via marriage) beats the 4-hop route through the child.
    const people = [
      { id: "a", name: "A", gender: "male" as const, spouseIds: ["w"] },
      { id: "w", name: "W", gender: "female" as const, fatherId: "f", spouseIds: ["a"] },
      { id: "s", name: "S", gender: "female" as const, fatherId: "f", spouseIds: [] },
      { id: "f", name: "F", gender: "male" as const, spouseIds: [] },
      { id: "c", name: "C", gender: "male" as const, fatherId: "a", motherId: "w", spouseIds: [] },
    ];
    const r = findRelationship(people, "a", "s");
    expect(r.connected && r.sentence).toBe("S is A's wife's sister");
  });
});

describe("bloodTerm", () => {
  it("handles any depth of grandparent", () => {
    expect(bloodTerm(2, 0, "female")).toBe("grandmother");
    expect(bloodTerm(5, 0, "male")).toBe("3x great-grandfather");
    expect(bloodTerm(0, 3, "female")).toBe("great-granddaughter");
  });

  it("handles distant cousins and removals", () => {
    expect(bloodTerm(5, 5, "male")).toBe("fourth cousin");
    expect(bloodTerm(12, 12, "male")).toBe("11th cousin");
    expect(bloodTerm(3, 6, "female")).toBe("second cousin 3 times removed");
    expect(bloodTerm(4, 2, "female")).toBe("first cousin twice removed");
  });

  it("handles aunts, uncles, nephews and nieces", () => {
    expect(bloodTerm(2, 1, "female")).toBe("aunt");
    expect(bloodTerm(4, 1, "male")).toBe("great-great-uncle");
    expect(bloodTerm(1, 3, "female")).toBe("great-niece");
  });
});
