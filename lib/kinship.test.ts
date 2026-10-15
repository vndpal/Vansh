import { describe, expect, it } from "vitest";
import { bloodTerm, findRelationship } from "./kinship";
import { samplePeople } from "./sample-family";
import type { Person } from "./types";

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

describe("Hindi words", () => {
  const hindi = (a: string, b: string, people = samplePeople) => {
    const r = findRelationship(people, a, b);
    return r.connected ? r.hindi : "not connected";
  };

  it("names parents, siblings and half-siblings", () => {
    expect(hindi("ravi", "suresh")).toBe("Pita");
    expect(hindi("ravi", "anita")).toBe("Mata");
    expect(hindi("ravi", "deepak")).toBe("Bhai");
    expect(hindi("neha", "meera")).toBe("Behen");
    expect(hindi("ravi", "asha")).toBe("Sauteli Behen");
  });

  it("tells Tau from Chacha by birth year", () => {
    expect(hindi("ravi", "mahesh")).toBe("Chacha");
    expect(hindi("ravi", "geeta")).toBe("Chachi");
    expect(hindi("vijay", "mohan")).toBe("Tau");
    expect(hindi("vijay", "savitri")).toBe("Tai");
    expect(hindi("rohan", "deepak")).toBe("Chacha");
    expect(hindi("rohan", "asha")).toBe("Bua");
  });

  it("names nephews, nieces, grandparents and grandchildren", () => {
    expect(hindi("mahesh", "ravi")).toBe("Bhatija");
    expect(hindi("mahesh", "asha")).toBe("Bhatiji");
    expect(hindi("asha", "rohan")).toBe("Bhatija");
    expect(hindi("ravi", "mohan")).toBe("Dada");
    expect(hindi("ravi", "savitri")).toBe("Dadi");
    expect(hindi("rohan", "mohan")).toBe("Pardada");
    expect(hindi("mohan", "ravi")).toBe("Pota");
    expect(hindi("mohan", "asha")).toBe("Poti");
    expect(hindi("hari", "ravi")).toBe("Parpota");
  });

  it("names cousins of any degree by side of the family", () => {
    expect(hindi("ravi", "arjun")).toBe("Chachera Bhai");
    expect(hindi("ravi", "kiran")).toBe("Chachera Bhai");
    expect(hindi("rohan", "tara")).toBe("Chacheri Behen");
    // A cousin's daughter is a Bhatiji, and a parent's older cousin is a Tau.
    expect(hindi("ravi", "tara")).toBe("Bhatiji");
    expect(hindi("tara", "ravi")).toBe("Tau");
  });

  it("names in-laws through one marriage", () => {
    expect(hindi("ravi", "priya")).toBe("Patni");
    expect(hindi("priya", "ravi")).toBe("Pati");
    expect(hindi("priya", "suresh")).toBe("Sasur");
    expect(hindi("priya", "anita")).toBe("Saas");
    expect(hindi("priya", "deepak")).toBe("Devar");
    expect(hindi("priya", "asha")).toBe("Nanad");
    expect(hindi("arjun", "meera")).toBe("Saali");
    expect(hindi("meera", "arjun")).toBe("Jija");
    expect(hindi("suresh", "priya")).toBe("Bahu");
    expect(hindi("dinesh", "arjun")).toBe("Damaad");
    expect(hindi("ravi", "usha")).toBe("Sauteli Maa");
    expect(hindi("usha", "ravi")).toBe("Sautela Beta");
  });

  it("names in-laws through two marriages", () => {
    expect(hindi("arjun", "sanjay")).toBe("Saadhu");
    expect(hindi("savitri", "radha")).toBe("Devrani");
    expect(hindi("radha", "savitri")).toBe("Jethani");
    expect(hindi("dinesh", "mahesh")).toBe("Samdhi");
    expect(hindi("mahesh", "dinesh")).toBe("Samdhi");
    expect(hindi("dinesh", "geeta")).toBe("Samdhan");
  });

  it("builds a phrase when no single word fits", () => {
    expect(hindi("ravi", "meera")).toBe("Bhabhi ki Behen");
    expect(hindi("ravi", "sanjay")).toBe("Bhabhi ka Jija");
    expect(hindi("ravi", "gopal")).toBe("Dada ka Bhai");
    expect(hindi("priya", "arjun")).toBe("Pati ka Chachera Bhai");
    expect(hindi("priya", "geeta")).toBe("Pati ki Chachi");
    expect(hindi("rohan", "hari")).toBe("Pardada ke Pita");
    expect(hindi("hari", "rohan")).toBe("Parpote ka Beta");
  });

  it("names the mother's side and the father's sister's family", () => {
    const person = (id: string, gender: "male" | "female", extra: Partial<Person> = {}): Person => ({ id, name: id, gender, spouseIds: [], ...extra });
    const family = [
      person("dada", "male"),
      person("nana", "male", { spouseIds: ["nani"] }),
      person("nani", "female", { spouseIds: ["nana"] }),
      person("papa", "male", { birthYear: 1962, fatherId: "dada", spouseIds: ["maa"] }),
      person("chacha", "male", { fatherId: "dada" }),
      person("bua", "female", { fatherId: "dada", spouseIds: ["phupha"] }),
      person("phupha", "male", { spouseIds: ["bua"] }),
      person("maa", "female", { fatherId: "nana", motherId: "nani", spouseIds: ["papa"] }),
      person("mama", "male", { fatherId: "nana", motherId: "nani", spouseIds: ["mami"] }),
      person("mami", "female", { spouseIds: ["mama"] }),
      person("mausi", "female", { fatherId: "nana", motherId: "nani", spouseIds: ["mausa"] }),
      person("mausa", "male", { spouseIds: ["mausi"] }),
      person("kid", "male", { fatherId: "papa", motherId: "maa" }),
      person("buaSon", "male", { fatherId: "phupha", motherId: "bua" }),
      person("mamaSon", "male", { fatherId: "mama", motherId: "mami" }),
      person("mausiDaughter", "female", { fatherId: "mausa", motherId: "mausi" }),
    ];
    const expected: Record<string, string> = {
      nana: "Nana",
      nani: "Nani",
      mama: "Mama",
      mami: "Mami",
      mausi: "Mausi",
      mausa: "Mausa",
      bua: "Bua",
      phupha: "Phupha",
      // No birth year, so it cannot tell which one.
      chacha: "Chacha or Tau",
      buaSon: "Phuphera Bhai",
      mamaSon: "Mamera Bhai",
      mausiDaughter: "Mauseri Behen",
    };
    for (const [id, word] of Object.entries(expected)) expect(hindi("kid", id, family)).toBe(word);

    expect(hindi("mama", "kid", family)).toBe("Bhanja");
    expect(hindi("bua", "kid", family)).toBe("Bhatija");
    expect(hindi("nana", "kid", family)).toBe("Nati");
    expect(hindi("papa", "mama", family)).toBe("Saala");
    expect(hindi("papa", "mausi", family)).toBe("Saali");
    expect(hindi("papa", "mami", family)).toBe("Salhaj");
    expect(hindi("papa", "mausa", family)).toBe("Saadhu");
    expect(hindi("maa", "bua", family)).toBe("Nanad");
    expect(hindi("maa", "phupha", family)).toBe("Nandoi");
    expect(hindi("maa", "chacha", family)).toBe("Devar or Jeth");
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
