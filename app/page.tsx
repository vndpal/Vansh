import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import FamilyApp from "@/components/FamilyApp";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";
import { loadPeople } from "@/lib/store";
import type { Person } from "@/lib/types";

export default async function Home() {
  const cookieStore = await cookies();
  if (!(await isValidSession(cookieStore.get(SESSION_COOKIE)?.value))) redirect("/login");

  let people: Person[];
  try {
    people = await loadPeople();
  } catch (error) {
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-lg font-semibold">Could not load the family tree</h1>
        <p className="text-slate-600">{error instanceof Error ? error.message : "Unknown error."}</p>
      </main>
    );
  }
  return <FamilyApp initialPeople={people} />;
}
