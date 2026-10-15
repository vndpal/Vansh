import { describe, expect, it } from "vitest";
import { samplePeople } from "./sample-family";
import { buildStack, type StackEntry, type StackFamily } from "./stack";
import type { Person } from "./types";

const names = (people: Person[]) => people.map((p) => p.id);
const childIds = (family: StackFamily) => family.children.map((c) => c.person.id);
const child = (family: StackFamily, id: string): StackEntry => family.children.find((c) => c.person.id === id)!;

describe("buildStack", () => {
  const stack = buildStack(samplePeople);
  const [hari, dinesh] = stack.families;

  it("starts a family at each head with no parents in the tree, oldest first", () => {
    expect(stack.families.map((f) => f.head.id)).toEqual(["hari", "dinesh"]);
    expect(stack.others.map((o) => o.person.id)).toEqual(["vikram"]);
  });

  it("nests children oldest first under their father", () => {
    expect(childIds(hari)).toEqual(["mohan", "gopal"]);
    const suresh = child(child(hari, "mohan").family!, "suresh").family!;
    expect(names(suresh.spouses)).toEqual(["anita", "usha"]);
    expect(childIds(suresh)).toEqual(["ravi", "deepak", "asha"]);
    expect(childIds(child(suresh, "ravi").family!)).toEqual(["rohan"]);
  });

  it("lists married daughters with their husbands", () => {
    expect(childIds(dinesh)).toEqual(["neha", "meera"]);
    expect(names(child(dinesh, "neha").spouses)).toEqual(["arjun"]);
    expect(child(dinesh, "neha").family).toBeUndefined();
  });

  it("shows everyone", () => {
    const shown = new Set([...stack.families.flatMap((f) => [...f.ids]), ...stack.others.map((o) => o.person.id)]);
    expect([...shown].sort()).toEqual(samplePeople.map((p) => p.id).sort());
  });

  it("nests the family of a husband from outside the tree under the daughter", () => {
    const people: Person[] = [
      { id: "dad", name: "Dad", gender: "male", spouseIds: [] },
      { id: "daughter", name: "Daughter", gender: "female", fatherId: "dad", spouseIds: ["groom"] },
      { id: "groom", name: "Groom", gender: "male", spouseIds: ["daughter"] },
      { id: "grandson", name: "Grandson", gender: "male", fatherId: "groom", motherId: "daughter", spouseIds: [] },
    ];
    const { families, others } = buildStack(people);
    expect(families.map((f) => f.head.id)).toEqual(["dad"]);
    const groom = child(families[0], "daughter").family!;
    expect(groom.head.id).toBe("groom");
    expect(childIds(groom)).toEqual(["grandson"]);
    expect(others).toEqual([]);
  });

  it("uses the mother as the head when no father is recorded", () => {
    const people: Person[] = [
      { id: "mum", name: "Mum", gender: "female", spouseIds: [] },
      { id: "kid", name: "Kid", gender: "male", motherId: "mum", spouseIds: [] },
    ];
    const { families } = buildStack(people);
    expect(families.map((f) => f.head.id)).toEqual(["mum"]);
    expect(childIds(families[0])).toEqual(["kid"]);
  });
});
