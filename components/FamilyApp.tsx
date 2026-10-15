"use client";

import { useMemo, useState } from "react";
import { layoutTree, pairKey } from "@/lib/layout";
import { buildIndex, familyOf, isFamilyHead } from "@/lib/tree";
import type { Person } from "@/lib/types";
import FinderPanel from "./FinderPanel";
import PersonPanel from "./PersonPanel";
import StackView from "./StackView";
import TreeView, { type Highlight } from "./TreeView";

type Panel = { kind: "person"; id?: string } | { kind: "find" } | null;
type View = "tree" | "stack";

const buttonClass = "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100";
const pillClass = "shrink-0 rounded-full bg-white/20 px-3 py-0.5 hover:bg-white/30";

export default function FamilyApp({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState(initialPeople);
  const [view, setView] = useState<View>("tree");
  const [panel, setPanel] = useState<Panel>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const layout = useMemo(() => layoutTree(people), [people]);
  const index = useMemo(() => buildIndex(people), [people]);
  const head = highlight?.headId ? index.byId.get(highlight.headId) : undefined;

  // Lights up the given people and the lines drawn between any of the given pairs.
  function highlightPeople(ids: string[], pairs: Array<[string, string]>, headId?: string) {
    const edgeIds = new Set<string>();
    for (const [a, b] of pairs) for (const id of layout.linkEdges.get(pairKey(a, b)) ?? []) edgeIds.add(id);
    setHighlight({ nodeIds: new Set(ids), edgeIds, headId });
  }

  function showPath(path: string[] | null) {
    if (!path) return setHighlight(null);
    highlightPeople(path, path.slice(1).map((id, i) => [path[i], id]));
  }

  // A family head's card highlights his family (click again to clear); anyone else opens for editing.
  function select(id: string) {
    if (!isFamilyHead(index, id)) return setPanel({ kind: "person", id });
    if (highlight?.headId === id) return setHighlight(null);
    const family = familyOf(index, id);
    highlightPeople(family, family.flatMap((a, i) => family.slice(i + 1).map((b): [string, string] => [a, b])), id);
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
        <h1 className="mr-auto leading-tight">
          <span className="block text-lg font-semibold">Vansh</span>
          <span className="sr-only"> - </span>
          <span className="block text-xs text-slate-500">The family tree</span>
        </h1>
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
          ) : view === "tree" ? (
            <TreeView layout={layout} highlight={highlight} onSelect={select} />
          ) : (
            <StackView people={people} highlight={highlight} onSelect={select} />
          )}
          {people.length > 0 && (
            <div role="group" aria-label="View" className="absolute left-3 top-3 z-10 flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-sm">
              {(["tree", "stack"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1 capitalize ${view === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {highlight && (
            <div className="absolute right-3 top-14 z-10 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-amber-500 p-1 text-sm font-medium text-white shadow sm:top-3">
              {head && (
                <>
                  <span className="truncate px-2">{head.name}&apos;s family</span>
                  <button type="button" className={pillClass} onClick={() => setPanel({ kind: "person", id: head.id })}>
                    Edit
                  </button>
                </>
              )}
              <button type="button" className={pillClass} onClick={() => setHighlight(null)}>
                {head ? "Clear" : "Clear highlight"}
              </button>
            </div>
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
