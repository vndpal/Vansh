import { describe, expect, it } from "vitest";
import { inLawFamilies, openFor, shownPeople } from "./inlaws";
import { samplePeople } from "./sample-family";
import type { Person } from "./types";

const p = (id: string, gender: Person["gender"], extra: Partial<Person> = {}): Person => ({ id, name: id, gender, spouseIds: [], ...extra });

// The sample family plus Priya's parents and brother, his wife Pooja and her father,
// and a husband for Asha with his parents and brother.
const people: Person[] = [
  ...samplePeople.map((x) =>
    x.id === "priya" ? { ...x, fatherId: "ramesh", motherId: "kusum" } : x.id === "asha" ? { ...x, spouseIds: ["vivek"] } : x,
  ),
  p("ramesh", "male", { birthYear: 1950, spouseIds: ["kusum"] }),
  p("kusum", "female", { birthYear: 1953, spouseIds: ["ramesh"] }),
  p("amit", "male", { birthYear: 1980, fatherId: "ramesh", motherId: "kusum", spouseIds: ["pooja"] }),
  p("pooja", "female", { birthYear: 1982, fatherId: "poojaDad", spouseIds: ["amit"] }),
  p("poojaDad", "male", { birthYear: 1955 }),
  p("prakash", "male", { birthYear: 1955 }),
  p("vivek", "male", { birthYear: 1983, fatherId: "prakash", spouseIds: ["asha"] }),
  p("rahul", "male", { birthYear: 1987, fatherId: "prakash" }),
];

const sorted = (ids: Iterable<string>) => [...ids].sort();

describe("inLawFamilies", () => {
  const inLaws = inLawFamilies(people);

  it("shows the main family by blood, with husbands and wives, and unconnected people", () => {
    const main = new Set(inLaws.main);
    for (const id of ["hari", "kamala", "ravi", "priya", "asha", "vivek", "neha", "vikram"]) expect(main.has(id)).toBe(true);
    for (const id of ["ramesh", "amit", "prakash", "dinesh", "meera"]) expect(main.has(id)).toBe(false);
  });

  it("folds each in-law family under the person who married in, nesting their own in-laws", () => {
    expect(sorted(inLaws.families.get("priya")!)).toEqual(["amit", "kusum", "pooja", "ramesh"]);
    expect(inLaws.families.get("pooja")).toEqual(["poojaDad"]);
    expect(sorted(inLaws.families.get("vivek")!)).toEqual(["prakash", "rahul"]);
    expect(sorted(inLaws.families.get("neha")!)).toEqual(["dinesh", "meera", "sanjay"]);
  });

  it("shows a family only when it and the families around it are open", () => {
    const shown = (...open: string[]) => shownPeople(inLaws, new Set(open));
    expect(shown().has("ramesh")).toBe(false);
    expect(shown("priya").has("ramesh")).toBe(true);
    expect(shown("priya").has("poojaDad")).toBe(false);
    expect(shown("pooja").has("poojaDad")).toBe(false);
    expect(shown("priya", "pooja").has("poojaDad")).toBe(true);
    expect(shownPeople(inLaws, new Set(inLaws.families.keys())).size).toBe(people.length);
  });

  it("opens whatever is needed to show someone", () => {
    expect(sorted(openFor(inLaws, new Set(), ["poojaDad", "ravi"]))).toEqual(["pooja", "priya"]);
  });
});
