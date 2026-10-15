"use client";

import { useMemo, useState } from "react";
import { sendTreeRequest } from "@/lib/api-client";
import { buildIndex, descendantIds } from "@/lib/tree";
import type { Gender, Person } from "@/lib/types";
import PersonPicker, { personLabel } from "./PersonPicker";

interface Props {
  people: Person[];
  /** Undefined when adding a new person. */
  personId?: string;
  onSaved: (people: Person[]) => void;
}

export default function PersonPanel({ people, personId, onSaved }: Props) {
  const existing = personId ? people.find((p) => p.id === personId) : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [nickname, setNickname] = useState(existing?.nickname ?? "");
  const [gender, setGender] = useState<Gender>(existing?.gender ?? "male");
  const [birthYear, setBirthYear] = useState(existing?.birthYear?.toString() ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [fatherId, setFatherId] = useState(existing?.fatherId);
  const [motherId, setMotherId] = useState(existing?.motherId);
  // The parent that was filled in from the other parent's spouse, if any.
  const [autoFilled, setAutoFilled] = useState<"father" | "mother">();
  const [spouseIds, setSpouseIds] = useState(existing?.spouseIds ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A parent cannot be this person or one of their descendants.
  const parentOptions = useMemo(() => {
    const blocked = personId ? descendantIds(buildIndex(people), personId) : new Set<string>();
    if (personId) blocked.add(personId);
    const allowed = people.filter((p) => !blocked.has(p.id));
    return { male: allowed.filter((p) => p.gender === "male"), female: allowed.filter((p) => p.gender === "female") };
  }, [people, personId]);
  const spouseOptions = people.filter((p) => p.id !== personId && !spouseIds.includes(p.id));

  // Choosing one parent fills in the other with that parent's spouse, when there is exactly
  // one. It never replaces a parent the user chose, and the filled-in one can be changed.
  function chooseParent(role: "father" | "mother", id: string | undefined) {
    const other = role === "father" ? "mother" : "father";
    const set = { father: setFatherId, mother: setMotherId };
    set[role](id);
    if (autoFilled === role) setAutoFilled(undefined);
    const otherId = role === "father" ? motherId : fatherId;
    if (!id || (otherId && autoFilled !== other)) return;
    const spouses = parentOptions[other === "father" ? "male" : "female"].filter((p) => p.spouseIds.includes(id));
    const spouse = spouses.length === 1 ? spouses[0].id : undefined;
    set[other](spouse);
    setAutoFilled(spouse ? other : undefined);
  }

  const autoFilledNote = (role: "father" | "mother") => {
    const from = people.find((p) => p.id === (role === "father" ? motherId : fatherId));
    if (autoFilled !== role || !from) return null;
    return (
      <p className="mt-1 text-xs text-slate-500">
        Filled in as {from.name}&apos;s {role === "father" ? "husband" : "wife"}. Change it if that&apos;s wrong.
      </p>
    );
  };

  async function run(request: () => Promise<Person[]>) {
    setBusy(true);
    setError("");
    try {
      onSaved(await request());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const body = { name, nickname, gender, birthYear: birthYear.trim() || undefined, notes, fatherId, motherId, spouseIds };
    run(() => (personId ? sendTreeRequest(`/api/people/${personId}`, "PUT", body) : sendTreeRequest("/api/people", "POST", body)));
  }

  if (personId && !existing) return <p className="text-sm text-slate-600">This person no longer exists.</p>;

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="person-name" className="mb-1 block text-sm font-medium text-slate-700">
          Name
        </label>
        <input
          id="person-name"
          required
          maxLength={100}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="person-nickname" className="mb-1 block text-sm font-medium text-slate-700">
          Nickname (optional)
        </label>
        <input
          id="person-nickname"
          maxLength={50}
          placeholder="e.g. Pappu, Guddu"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Gender</legend>
        <div className="flex gap-4">
          {(["male", "female"] as const).map((g) => (
            <label key={g} className="flex items-center gap-2 text-base capitalize">
              <input type="radio" name="gender" checked={gender === g} onChange={() => setGender(g)} />
              {g}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="person-birth" className="mb-1 block text-sm font-medium text-slate-700">
          Birth year (optional)
        </label>
        <input
          id="person-birth"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-base"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
        />
      </div>

      <div>
        <label htmlFor="person-notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notes (optional)
        </label>
        <textarea
          id="person-notes"
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <PersonPicker label="Father" options={parentOptions.male} value={fatherId} onChange={(id) => chooseParent("father", id)} />
        {autoFilledNote("father")}
      </div>
      <div>
        <PersonPicker label="Mother" options={parentOptions.female} value={motherId} onChange={(id) => chooseParent("mother", id)} />
        {autoFilledNote("mother")}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Spouses</p>
        {spouseIds.length === 0 && <p className="mb-2 text-sm text-slate-500">None</p>}
        <ul className="mb-2 space-y-1">
          {spouseIds.map((id) => {
            const spouse = people.find((p) => p.id === id);
            return (
              <li key={id} className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-1.5">
                <span>{spouse ? personLabel(spouse) : "Unknown person"}</span>
                <button
                  type="button"
                  className="text-sm text-rose-600 hover:underline"
                  onClick={() => setSpouseIds(spouseIds.filter((s) => s !== id))}
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
        <PersonPicker
          label="Add spouse"
          options={spouseOptions}
          value={undefined}
          onChange={(id) => id && setSpouseIds([...spouseIds, id])}
        />
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2 pt-2">
        <button type="submit" disabled={busy} className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
          {busy ? "Saving..." : personId ? "Save changes" : "Add person"}
        </button>
        {personId &&
          (confirmDelete ? (
            <>
              <button
                type="button"
                disabled={busy}
                className="rounded-md bg-rose-600 px-4 py-2 text-white disabled:opacity-50"
                onClick={() => run(() => sendTreeRequest(`/api/people/${personId}`, "DELETE"))}
              >
                Yes, delete {existing?.name}
              </button>
              <button type="button" className="rounded-md border border-slate-300 px-4 py-2" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-md border border-rose-300 px-4 py-2 text-rose-700"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          ))}
      </div>
    </form>
  );
}
