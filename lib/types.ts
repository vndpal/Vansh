export type Gender = "male" | "female";

export interface Person {
  id: string;
  name: string;
  /** Pet name or what the family calls them, e.g. "Pappu". */
  nickname?: string;
  gender: Gender;
  birthYear?: number;
  notes?: string;
  fatherId?: string;
  motherId?: string;
  spouseIds: string[];
}
