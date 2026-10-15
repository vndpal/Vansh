// Sample family used by the seed script and the tests: 26 people over 5 generations,
// plus one person who is not connected to anyone.
import type { Gender, Person } from "./types";

type Extra = Partial<Pick<Person, "fatherId" | "motherId" | "notes">>;

const person = (id: string, name: string, gender: Gender, birthYear: number, extra: Extra = {}): Person => ({
  id,
  name,
  gender,
  birthYear,
  spouseIds: [],
  ...extra,
});

const people: Person[] = [
  // Generation 1
  person("hari", "Hari", "male", 1900),
  person("kamala", "Kamala", "female", 1904),
  // Generation 2
  person("mohan", "Mohan", "male", 1925, { fatherId: "hari", motherId: "kamala" }),
  person("savitri", "Savitri", "female", 1928),
  person("gopal", "Gopal", "male", 1928, { fatherId: "hari", motherId: "kamala" }),
  person("radha", "Radha", "female", 1931),
  // Generation 3
  person("suresh", "Suresh", "male", 1950, { fatherId: "mohan", motherId: "savitri" }),
  person("anita", "Anita", "female", 1952),
  person("usha", "Usha", "female", 1958, { notes: "Suresh's second wife" }),
  person("mahesh", "Mahesh", "male", 1953, { fatherId: "mohan", motherId: "savitri" }),
  person("geeta", "Geeta", "female", 1956),
  person("vijay", "Vijay", "male", 1955, { fatherId: "gopal", motherId: "radha" }),
  person("sunita", "Sunita", "female", 1958),
  person("dinesh", "Dinesh", "male", 1950),
  // Generation 4
  person("ravi", "Ravi", "male", 1975, { fatherId: "suresh", motherId: "anita" }),
  person("priya", "Priya", "female", 1978),
  person("deepak", "Deepak", "male", 1978, { fatherId: "suresh", motherId: "anita" }),
  person("asha", "Asha", "female", 1985, { fatherId: "suresh", motherId: "usha" }),
  person("arjun", "Arjun", "male", 1980, { fatherId: "mahesh", motherId: "geeta" }),
  person("neha", "Neha", "female", 1982, { fatherId: "dinesh" }),
  person("meera", "Meera", "female", 1985, { fatherId: "dinesh" }),
  person("sanjay", "Sanjay", "male", 1983),
  person("kiran", "Kiran", "male", 1982, { fatherId: "vijay", motherId: "sunita" }),
  // Generation 5
  person("rohan", "Rohan", "male", 2005, { fatherId: "ravi", motherId: "priya" }),
  person("tara", "Tara", "female", 2010, { fatherId: "kiran" }),
  // Not connected to anyone
  person("vikram", "Vikram", "male", 1970, { notes: "Family friend" }),
];

const marriages: Array<[string, string]> = [
  ["hari", "kamala"],
  ["mohan", "savitri"],
  ["gopal", "radha"],
  ["suresh", "anita"],
  ["suresh", "usha"],
  ["mahesh", "geeta"],
  ["vijay", "sunita"],
  ["ravi", "priya"],
  ["arjun", "neha"],
  ["meera", "sanjay"],
];

for (const [a, b] of marriages) {
  people.find((p) => p.id === a)!.spouseIds.push(b);
  people.find((p) => p.id === b)!.spouseIds.push(a);
}

export const samplePeople: Person[] = people;
