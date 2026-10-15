import { describe, expect, it } from "vitest";
import { relativesOf, type Side } from "./relatives";
import { samplePeople } from "./sample-family";

const view = (id: string) =>
  Object.fromEntries(relativesOf(samplePeople, id).map(({ side, relatives }) => [side, relatives.map((r) => `${r.person.id}:${r.relation}`)])) as Partial<
    Record<Side, string[]>
  >;

describe("relativesOf", () => {
  it("lists close family as parents, spouse, brothers and sisters, then children", () => {
    expect(view("ravi").close).toEqual(["suresh:Pita", "anita:Mata", "priya:Patni", "deepak:Bhai", "asha:Sauteli Behen", "rohan:Beta"]);
  });

  it("splits the father's side from the mother's side", () => {
    const ravi = view("ravi");
    expect(ravi.father?.slice(0, 3)).toEqual(["mohan:Dada", "savitri:Dadi", "usha:Sauteli Maa"]);
    expect(ravi.father).toContain("mahesh:Chacha");
    expect(ravi.mother).toBeUndefined();
    expect(view("tara").father).toContain("vijay:Dada");
  });

  it("puts in-laws and brothers' and sisters' families in their own groups", () => {
    const neha = view("neha");
    expect(neha.close).toEqual(["dinesh:Pita", "arjun:Pati", "meera:Behen"]);
    expect(neha.siblings).toEqual(["sanjay:Jija"]);
    expect(neha.spouse?.slice(0, 2)).toEqual(["mahesh:Sasur", "geeta:Saas"]);
    expect(view("suresh").children).toEqual(["priya:Bahu", "rohan:Pota"]);
  });

  it("leaves out people who are not connected", () => {
    expect(relativesOf(samplePeople, "vikram")).toEqual([]);
    expect(Object.values(view("ravi")).flat().some((r) => r.startsWith("vikram:"))).toBe(false);
  });
});
