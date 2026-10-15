"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { relativesOf, SIDE_TITLES, type Side } from "@/lib/relatives";
import type { Person } from "@/lib/types";
import PersonPicker, { personLabel } from "./PersonPicker";

interface Props {
  people: Person[];
  personId?: string;
  onSelect: (id: string | undefined) => void;
  onEdit: (id: string) => void;
}

/** Long groups show this many people until expanded. */
const PREVIEW = 10;

const genderDot = { male: "bg-teal-500", female: "bg-violet-500" };

/** Search for anyone and see all their relatives, grouped by side of the family. */
export default function FamilyPanel({ people, personId, onSelect, onEdit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<Side>>(new Set());
  const person = personId ? people.find((p) => p.id === personId) : undefined;
  const sections = useMemo(() => (personId ? relativesOf(people, personId) : []), [people, personId]);

  // Each person opens at the top of the panel. The parent remounts this panel per person.
  useEffect(() => {
    rootRef.current?.closest("aside")?.scrollTo({ top: 0 });
  }, []);

  return (
    <div ref={rootRef} className="space-y-4">
      <PersonPicker label="Name or nickname" options={people} value={personId} onChange={onSelect} placeholder="Type to search" />

      {person && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">
              {person.name}
              {person.nickname && <span className="font-normal italic text-slate-500"> &ldquo;{person.nickname}&rdquo;</span>}
            </p>
            {person.birthYear !== undefined && <p className="text-xs text-slate-500">b. {person.birthYear}</p>}
          </div>
          <button type="button" className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm hover:bg-slate-50" onClick={() => onEdit(person.id)}>
            Edit
          </button>
        </div>
      )}

      {person && sections.length === 0 && <p className="text-sm text-slate-600">No relatives recorded for {person.name} yet.</p>}

      {sections.map(({ side, relatives }) => {
        const all = side === "close" || expanded.has(side) || relatives.length <= PREVIEW;
        return (
          <section key={side}>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">
              {SIDE_TITLES[side]} <span className="font-normal text-slate-400">{relatives.length}</span>
            </h3>
            <ul>
              {(all ? relatives : relatives.slice(0, PREVIEW)).map((r) => (
                <li key={r.person.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.person.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100"
                  >
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${genderDot[r.person.gender]}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{personLabel(r.person)}</span>
                    <span className="max-w-[55%] text-right text-sm font-medium text-slate-800">
                      {r.relation}
                      {r.term && <span className="block text-xs font-normal text-slate-500">{r.term}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!all && (
              <button
                type="button"
                className="mt-1 px-2 text-sm text-slate-600 underline hover:text-slate-900"
                onClick={() => setExpanded(new Set(expanded).add(side))}
              >
                Show all {relatives.length}
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
