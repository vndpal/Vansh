"use client";

import { useMemo, useState } from "react";
import { layoutTree, pairKey } from "@/lib/layout";
import type { Person } from "@/lib/types";
import FinderPanel from "./FinderPanel";
import PersonPanel from "./PersonPanel";
import TreeView, { type Highlight } from "./TreeView";

type Panel = { kind: "person"; id?: string } | { kind: "find" } | null;

const buttonClass = "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100";

export default function FamilyApp({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState(initialPeople);
  const [panel, setPanel] = useState<Panel>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const layout = useMemo(() => layoutTree(people), [people]);

  function showPath(path: string[] | null) {
    if (!path) return setHighlight(null);
    const edgeIds = new Set<string>();
    for (let i = 1; i < path.length; i++) {
      for (const id of layout.linkEdges.get(pairKey(path[i - 1], path[i])) ?? []) edgeIds.add(id);
    }
    setHighlight({ nodeIds: new Set(path), edgeIds });
  }

  function saved(next: Person[]) {
    setPeople(next);
    setHighlight(null);
    setPanel(null);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const panelTitle = panel?.kind === "find" ? "Find relationship" : panel?.id ? "Edit person" : "Add person";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <h1 className="mr-auto text-lg font-semibold">Family Tree</h1>
        <button type="button" className={buttonClass} onClick={() => setPanel({ kind: "person" })}>
          Add<span className="hidden sm:inline"> person</span>
        </button>
        <button type="button" className={buttonClass} onClick={() => setPanel({ kind: "find" })}>
          Find<span className="hidden sm:inline"> relationship</span>
        </button>
        <button type="button" className={buttonClass} onClick={logout}>
          Log out
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="relative min-h-0 flex-1">
          {people.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-slate-600">The tree is empty.</p>
              <button type="button" className="rounded-md bg-slate-900 px-4 py-2 text-white" onClick={() => setPanel({ kind: "person" })}>
                Add the first person
              </button>
            </div>
          ) : (
            <TreeView layout={layout} highlight={highlight} onSelect={(id) => setPanel({ kind: "person", id })} />
          )}
          {highlight && (
            <button
              type="button"
              className="absolute right-3 top-3 z-10 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-medium text-white shadow"
              onClick={() => setHighlight(null)}
            >
              Clear highlight
            </button>
          )}
        </main>

        {panel && (
          <aside className="max-h-[60dvh] overflow-y-auto border-t border-slate-200 bg-white p-4 md:max-h-none md:w-96 md:border-l md:border-t-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{panelTitle}</h2>
              <button type="button" className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setPanel(null)}>
                Close
              </button>
            </div>
            {panel.kind === "find" ? (
              <FinderPanel people={people} onPath={showPath} />
            ) : (
              <PersonPanel key={panel.id ?? "new"} people={people} personId={panel.id} onSaved={saved} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
