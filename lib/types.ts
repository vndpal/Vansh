export type Gender = "male" | "female";

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  birthYear?: number;
  notes?: string;
  fatherId?: string;
  motherId?: string;
  spouseIds: string[];
}
