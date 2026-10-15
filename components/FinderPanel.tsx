"use client";

import { useState } from "react";
import { findRelationship, type Relationship } from "@/lib/kinship";
import type { Person } from "@/lib/types";
import PersonPicker from "./PersonPicker";

interface Props {
  people: Person[];
  onPath: (path: string[] | null) => void;
}

export default function FinderPanel({ people, onPath }: Props) {
  const [aId, setAId] = useState<string>();
  const [bId, setBId] = useState<string>();
  const [result, setResult] = useState<{ relationship: Relationship; a: Person; b: Person } | null>(null);
  const [error, setError] = useState("");

  function find() {
    const a = people.find((p) => p.id === aId);
    const b = people.find((p) => p.id === bId);
    if (!a || !b) return;
    if (a.id === b.id) {
      setError("Pick two different people.");
      setResult(null);
      onPath(null);
      return;
    }
    const relationship = findRelationship(people, a.id, b.id);
    setError("");
    setResult({ relationship, a, b });
    onPath(relationship.connected ? relationship.path : null);
  }

  function clear() {
    setResult(null);
    setError("");
    onPath(null);
  }

  const r = result?.relationship;

  return (
    <div className="space-y-4">
      <PersonPicker label="Person A" options={people} value={aId} onChange={setAId} />
      <PersonPicker label="Person B" options={people} value={bId} onChange={setBId} />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!aId || !bId}
          onClick={find}
          className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Find
        </button>
        {result && (
          <button type="button" onClick={clear} className="rounded-md border border-slate-300 px-4 py-2">
            Clear
          </button>
        )}
      </div>

      {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {result && r && !r.connected && (
        <p className="rounded-md bg-slate-100 px-3 py-2">
          {result.a.name} and {result.b.name} are not connected in this tree.
        </p>
      )}

      {r?.connected && result && (
        <div className="space-y-3 rounded-md bg-amber-50 p-3">
          <p className="text-lg font-semibold">{r.sentence}.</p>
          <p className="break-words text-sm text-slate-700">{r.chain}</p>
          {r.term && (
            <p className="text-sm">
              <span className="text-slate-600">Relationship: </span>
              <span className="font-semibold">
                {result.b.name} is {result.a.name}&apos;s {r.term}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
