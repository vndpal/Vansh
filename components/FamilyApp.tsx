"use client";

import { useMemo, useState } from "react";
import { inLawFamilies, openFor, shownPeople } from "@/lib/inlaws";
import { layoutTree, pairKey } from "@/lib/layout";
import { buildIndex, closeFamilyOf, familyOf, isFamilyHead } from "@/lib/tree";
import type { Person } from "@/lib/types";
import FamilyPanel from "./FamilyPanel";
import FinderPanel from "./FinderPanel";
import PersonPanel from "./PersonPanel";
import StackView from "./StackView";
import TreeView, { type Highlight } from "./TreeView";

type Panel = { kind: "person"; id?: string } | { kind: "find" } | { kind: "family"; id?: string } | null;
type View = "tree" | "stack";
/** Who is highlighted, and which pairs of them to draw the lines between. */
type Selection = { ids: string[]; pairs: Array<[string, string]> } & Pick<Highlight, "headId" | "focusId">;

const buttonClass = "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100";
const pillClass = "shrink-0 rounded-full bg-white/20 px-3 py-0.5 hover:bg-white/30";

export default function FamilyApp({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState(initialPeople);
  const [view, setView] = useState<View>("tree");
  const [panel, setPanel] = useState<Panel>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const index = useMemo(() => buildIndex(people), [people]);

  // In-law families (a son's wife's family, a daughter's husband's family) start folded away
  // in the tree; `open` holds the people who married in whose families are shown.
  const inLaws = useMemo(() => inLawFamilies(people), [people]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const shown = useMemo(() => shownPeople(inLaws, open), [inLaws, open]);
  const layout = useMemo(() => layoutTree(people.filter((p) => shown.has(p.id))), [people, shown]);
  const toggles = useMemo(
    () => new Map([...inLaws.families].filter(([id]) => shown.has(id)).map(([id, ids]) => [id, { count: ids.length, open: open.has(id) }])),
    [inLaws, shown, open],
  );
  const allOpen = [...inLaws.families.keys()].every((id) => open.has(id));
  const toggleInLaws = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  // The highlighted lines come from the current layout, which changes as families open.
  const nodeIds = useMemo(() => new Set(selection?.ids), [selection]);
  const highlight = useMemo<Highlight | null>(() => {
    if (!selection) return null;
    const edgeIds = new Set<string>();
    for (const [a, b] of selection.pairs) for (const id of layout.linkEdges.get(pairKey(a, b)) ?? []) edgeIds.add(id);
    return { nodeIds, edgeIds, headId: selection.headId, focusId: selection.focusId };
  }, [selection, nodeIds, layout]);
  const head = selection?.headId ? index.byId.get(selection.headId) : undefined;
  const focused = selection?.focusId ? index.byId.get(selection.focusId) : undefined;

  // Lights up the given people and the lines between any of the given pairs, opening any
  // folded family they are in.
  function highlightPeople(ids: string[], pairs: Array<[string, string]>, about: Pick<Highlight, "headId" | "focusId"> = {}) {
    setOpen((prev) => openFor(inLaws, prev, ids));
    setSelection({ ids, pairs, ...about });
  }

  const allPairs = (ids: string[]) => ids.flatMap((a, i) => ids.slice(i + 1).map((b): [string, string] => [a, b]));

  function showPath(path: string[] | null) {
    if (!path) return setSelection(null);
    highlightPeople(path, path.slice(1).map((id, i) => [path[i], id]));
  }

  // A family head's card highlights his family (click again to clear); anyone else opens for editing.
  function select(id: string) {
    if (!isFamilyHead(index, id)) return setPanel({ kind: "person", id });
    if (selection?.headId === id) return setSelection(null);
    const family = familyOf(index, id);
    highlightPeople(family, allPairs(family), { headId: id });
  }

  // Search: show everyone related to this person, and light up their close family.
  function focus(id: string | undefined) {
    setPanel({ kind: "family", id });
    if (!id) return setSelection(null);
    const family = closeFamilyOf(index, id);
    highlightPeople(family, allPairs(family), { focusId: id });
  }

  function saved(next: Person[]) {
    // Keep whoever was just added or edited in view, even inside a folded family.
    const before = new Set(people.map((p) => p.id));
    const touched = next.filter((p) => !before.has(p.id)).map((p) => p.id);
    if (panel?.kind === "person" && panel.id) touched.push(panel.id);
    setOpen((prev) => openFor(inLawFamilies(next), prev, touched));
    setPeople(next);
    setSelection(null);
    setPanel(null);
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const panelTitle =
    panel?.kind === "find" ? "Find relationship" : panel?.kind === "family" ? "Search family" : panel?.id ? "Edit person" : "Add person";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-1.5 border-b border-slate-200 bg-white px-3 py-2 sm:gap-2">
        <h1 className="mr-auto leading-tight">
          <span className="block text-lg font-semibold">Vansh</span>
          <span className="sr-only"> - </span>
          <span className="block text-xs text-slate-500">The family tree</span>
        </h1>
        <button type="button" className={`${buttonClass} flex items-center gap-1.5`} aria-label="Search family" onClick={() => setPanel({ kind: "family" })}>
          <svg viewBox="0 0 20 20" aria-hidden className="h-4 w-4">
            <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="hidden sm:inline">Search</span>
        </button>
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
            <TreeView layout={layout} highlight={highlight} onSelect={select} inLaws={toggles} onToggleInLaws={toggleInLaws} />
          ) : (
            <StackView people={people} highlight={highlight} onSelect={select} />
          )}
          {people.length > 0 && (
            <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
              <div role="group" aria-label="View" className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-sm">
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
              {view === "tree" && inLaws.families.size > 0 && (
                <button
                  type="button"
                  title={allOpen ? "Fold away every in-law family" : "Show every in-law family"}
                  onClick={() => setOpen(allOpen ? new Set() : new Set(inLaws.families.keys()))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-slate-100"
                >
                  {allOpen ? "Collapse all" : "Expand all"}
                </button>
              )}
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
              {focused && <span className="truncate px-2">{focused.name}&apos;s close family</span>}
              <button type="button" className={pillClass} onClick={() => setSelection(null)}>
                {head || focused ? "Clear" : "Clear highlight"}
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
            ) : panel.kind === "family" ? (
              <FamilyPanel key={panel.id ?? "none"} people={people} personId={panel.id} onSelect={focus} onEdit={(id) => setPanel({ kind: "person", id })} />
            ) : (
              <PersonPanel key={panel.id ?? "new"} people={people} personId={panel.id} onSaved={saved} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
