"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Person } from "@/lib/types";

export const personLabel = (p: Person) => (p.birthYear !== undefined ? `${p.name} (${p.birthYear})` : p.name);

interface Props {
  label: string;
  options: Person[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  placeholder?: string;
}

/** Searchable dropdown of people, filtered by name. Works with touch and keyboard. */
export default function PersonPicker({ label, options, value, onChange, placeholder = "Search by name" }: Props) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? options.find((p) => p.id === value) : undefined;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          autoComplete="off"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-base"
          placeholder={placeholder}
          value={open ? query : selected ? personLabel(selected) : ""}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              e.preventDefault();
              if (open && matches[0]) choose(matches[0].id);
            }
          }}
        />
        {selected && (
          <button
            type="button"
            className="shrink-0 rounded-md border border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-100"
            onClick={() => onChange(undefined)}
            aria-label={`Clear ${label.toLowerCase()}`}
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-base hover:bg-slate-100"
                onClick={() => choose(p.id)}
              >
                {personLabel(p)}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No matches</li>}
        </ul>
      )}
    </div>
  );
}
