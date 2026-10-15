import { describe, expect, it } from "vitest";
import { samplePeople } from "./sample-family";
import { buildIndex, closeFamilyOf, deletePerson, familyOf, isFamilyHead, parsePersonInput, upsertPerson, type PersonInput } from "./tree";

const inputFor = (id: string): PersonInput => {
  const { id: _id, ...rest } = samplePeople.find((p) => p.id === id)!;
  return rest;
};

describe("upsertPerson", () => {
  it("rejects making a person their own ancestor", () => {
    expect(() => upsertPerson(samplePeople, "hari", { ...inputFor("hari"), fatherId: "ravi" }, false)).toThrow(/own ancestor/);
    expect(() => upsertPerson(samplePeople, "ravi", { ...inputFor("ravi"), fatherId: "ravi" }, false)).toThrow(/own father/);
  });

  it("rejects a parent of the wrong gender", () => {
    expect(() => upsertPerson(samplePeople, "ravi", { ...inputFor("ravi"), motherId: "suresh" }, false)).toThrow(/cannot be set as mother/);
  });

  it("rejects a gender change that would break a parent link", () => {
    expect(() => upsertPerson(samplePeople, "suresh", { ...inputFor("suresh"), gender: "female" }, false)).toThrow(/father of/);
  });

  it("keeps spouse links two-way", () => {
    const added = upsertPerson(samplePeople, "vikram", { ...inputFor("vikram"), spouseIds: ["asha"] }, false);
    expect(added.find((p) => p.id === "asha")!.spouseIds).toEqual(["vikram"]);
    const removed = upsertPerson(added, "asha", { ...inputFor("asha"), spouseIds: [] }, false);
    expect(removed.find((p) => p.id === "vikram")!.spouseIds).toEqual([]);
  });
});

describe("deletePerson", () => {
  it("removes every link pointing to the deleted person", () => {
    const people = deletePerson(samplePeople, "suresh");
    expect(people.find((p) => p.id === "suresh")).toBeUndefined();
    expect(people.find((p) => p.id === "ravi")!.fatherId).toBeUndefined();
    expect(people.find((p) => p.id === "ravi")!.motherId).toBe("anita");
    expect(people.find((p) => p.id === "anita")!.spouseIds).toEqual([]);
    expect(people.find((p) => p.id === "usha")!.spouseIds).toEqual([]);
  });
});

describe("family heads", () => {
  const index = buildIndex(samplePeople);

  it("are men with children", () => {
    expect(isFamilyHead(index, "suresh")).toBe(true);
    expect(isFamilyHead(index, "anita")).toBe(false);
    expect(isFamilyHead(index, "deepak")).toBe(false);
  });

  it("have a family of wives and children, each oldest first", () => {
    expect(familyOf(index, "suresh")).toEqual(["suresh", "anita", "usha", "ravi", "deepak", "asha"]);
    expect(familyOf(index, "dinesh")).toEqual(["dinesh", "neha", "meera"]);
  });
});

describe("parsePersonInput", () => {
  it("keeps a trimmed nickname, drops an empty one and rejects a long one", () => {
    expect(parsePersonInput({ name: "Ravi", gender: "male", nickname: "  Pappu " }).nickname).toBe("Pappu");
    expect(parsePersonInput({ name: "Ravi", gender: "male", nickname: "  " }).nickname).toBeUndefined();
    expect(() => parsePersonInput({ name: "Ravi", gender: "male", nickname: "x".repeat(51) })).toThrow(/Nickname is too long/);
  });
});

describe("closeFamilyOf", () => {
  it("is the person, parents, spouses, brothers and sisters, and children", () => {
    expect(closeFamilyOf(buildIndex(samplePeople), "ravi").sort()).toEqual(["anita", "asha", "deepak", "priya", "ravi", "rohan", "suresh"]);
  });
});
