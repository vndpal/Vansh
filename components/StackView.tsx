"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { NodeState } from "@/lib/layout";
import { buildStack, type StackEntry, type StackFamily } from "@/lib/stack";
import { buildIndex, isFamilyHead } from "@/lib/tree";
import type { Person } from "@/lib/types";
import { genderStyle, HEAD_HINT, HeadTag } from "./person-style";
import type { Highlight } from "./TreeView";

interface Props {
  people: Person[];
  highlight: Highlight | null;
  onSelect: (id: string) => void;
}

/** Families as nested lists: the head and his wives on one line, their children indented below. */
export default function StackView({ people, highlight, onSelect }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { stack, index, heads } = useMemo(() => {
    const index = buildIndex(people);
    const heads = new Set(people.filter((p) => isFamilyHead(index, p.id)).map((p) => p.id));
    return { stack: buildStack(people), index, heads };
  }, [people]);

  // A new highlight opens every family so nobody highlighted is hidden.
  const [shownHighlight, setShownHighlight] = useState(highlight);
  if (highlight !== shownHighlight) {
    setShownHighlight(highlight);
    if (highlight) setCollapsed(new Set());
  }

  useEffect(() => {
    rootRef.current?.querySelector("[data-highlight]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const stateOf = (id: string): NodeState => (highlight ? (highlight.nodeIds.has(id) ? "highlight" : "dim") : "normal");

  function chip(person: Person) {
    const state = stateOf(person.id);
    const isHead = heads.has(person.id);
    const { border, tint } = genderStyle[person.gender];
    return (
      <button
        type="button"
        title={isHead ? HEAD_HINT : undefined}
        data-highlight={state === "highlight" || undefined}
        onClick={() => onSelect(person.id)}
        className={`inline-flex min-w-0 max-w-full scroll-mb-4 scroll-mt-24 items-center gap-1.5 rounded-md border-2 px-2 py-1 text-left transition-opacity ${border} ${
          state === "highlight" ? "bg-amber-50 ring-2 ring-amber-400" : tint
        } ${state === "dim" ? "opacity-25" : ""}`}
      >
        {isHead && <HeadTag />}
        <span className="truncate text-sm font-semibold text-slate-900">{person.name}</span>
        {person.nickname && <span className="shrink-0 text-xs italic text-slate-500">&ldquo;{person.nickname}&rdquo;</span>}
        {person.birthYear !== undefined && <span className="shrink-0 text-xs text-slate-500">{person.birthYear}</span>}
      </button>
    );
  }

  // A person and their spouses, joined by a short line like in the tree.
  function couple(person: Person, spouses: Person[], note?: React.ReactNode) {
    return (
      <>
        {chip(person)}
        {note}
        {spouses.map((spouse) => (
          <span key={spouse.id} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3 shrink-0 bg-slate-300" />
            <span className="sr-only">married to</span>
            {chip(spouse)}
          </span>
        ))}
      </>
    );
  }

  function familyBlock(family: StackFamily, note?: React.ReactNode) {
    const { head, children } = family;
    const open = !collapsed.has(head.id);
    return (
      <div>
        <div className="flex items-start gap-1">
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} ${head.name}'s children`}
            onClick={() => toggle(head.id)}
            className="flex h-8 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          >
            <svg viewBox="0 0 20 20" aria-hidden className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}>
              <path d="M7 4l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {couple(head, family.spouses, note)}
            {!open && (
              <span className="text-xs text-slate-500">
                {children.length} {children.length === 1 ? "child" : "children"}
              </span>
            )}
          </div>
        </div>
        {open && (
          <ul className="ml-3 mt-1.5 space-y-1.5 border-l-2 border-slate-200 pl-2">
            {children.map((entry) => (
              <li key={entry.person.id}>{entryRow(entry, family)}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function entryRow(entry: StackEntry, parent: StackFamily) {
    // With more than one wife, say whose child this is.
    const mother = parent.spouses.length > 1 && entry.person.motherId ? index.byId.get(entry.person.motherId) : undefined;
    const note = mother && <span className="text-xs text-slate-500">mother: {mother.name}</span>;
    if (entry.family) return familyBlock(entry.family, entry.family.head.id === entry.person.id ? note : undefined);
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 pl-7">
        {couple(entry.person, entry.spouses, note)}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="h-full overflow-y-auto px-3 pb-6 pt-16">
      <div className="mx-auto max-w-3xl space-y-3">
        {stack.families.map((family) => (
          <section key={family.head.id} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            {familyBlock(family)}
          </section>
        ))}
        {stack.others.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            <h2 className="mb-2 px-1 text-sm font-medium text-slate-600">Others</h2>
            <ul className="space-y-1.5">
              {stack.others.map((entry) => (
                <li key={entry.person.id} className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {couple(entry.person, entry.spouses)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
