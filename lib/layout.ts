// Turns the people list into React Flow nodes and edges laid out top-down with dagre.
// Spouses are grouped into one dagre node so they always sit side by side, and
// brothers and sisters are kept in birth order, eldest on the left.
import dagre from "@dagrejs/dagre";
import type { BuiltInEdge, Node } from "@xyflow/react";
import { buildIndex, byBirthYear, isFamilyHead } from "./tree";
import type { Person } from "./types";

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 56;
const SPOUSE_GAP = 32;
const EDGE_STYLE = { stroke: "#94a3b8", strokeWidth: 1.5 };

export type NodeState = "normal" | "highlight" | "dim";
export type PersonNode = Node<
  {
    person: Person;
    isHead: boolean;
    state?: NodeState;
    /** Set on someone who married in and whose own family can be shown or folded away. */
    inLaws?: { count: number; open: boolean };
  },
  "person"
>;
export type UnionNode = Node<Record<string, never>, "union">;

export interface TreeLayout {
  nodes: Array<PersonNode | UnionNode>;
  edges: BuiltInEdge[];
  /** Edge ids that draw the link between two people, keyed by pairKey. */
  linkEdges: Map<string, string[]>;
}

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function spouseGroups(people: Person[], byId: Map<string, Person>, spouses: Map<string, Set<string>>): string[][] {
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const p of people) {
    if (seen.has(p.id)) continue;
    const group: string[] = [];
    const stack = [p.id];
    seen.add(p.id);
    while (stack.length) {
      const id = stack.pop()!;
      group.push(id);
      for (const s of spouses.get(id) ?? []) {
        if (!seen.has(s)) {
          seen.add(s);
          stack.push(s);
        }
      }
    }
    if (group.length === 2) {
      // Husband on the left by convention.
      if (byId.get(group[0])!.gender === "female") group.reverse();
      groups.push(group);
    } else if (group.length > 2) {
      // Walk from the eldest of those with the fewest spouses, visiting spouses oldest
      // first, so remarriage chains stay in order.
      const order: string[] = [];
      const oldestFirst = (ids: Iterable<string>) => [...ids].map((id) => byId.get(id)!).sort(byBirthYear);
      const visit = (id: string) => {
        order.push(id);
        for (const s of oldestFirst(spouses.get(id)!)) if (!order.includes(s.id)) visit(s.id);
      };
      const fewest = Math.min(...group.map((id) => spouses.get(id)!.size));
      visit(oldestFirst(group.filter((id) => spouses.get(id)!.size === fewest))[0].id);
      groups.push(order);
    } else {
      groups.push(group);
    }
  }
  return groups;
}

/**
 * Dagre order constraints that keep each couple's children eldest-on-the-left. With
 * several wives, each wife's children stay together under her. A constraint that
 * would contradict an earlier one (possible when two families intermarry) is skipped.
 */
function siblingConstraints(
  people: Person[],
  groups: string[][],
  groupOf: Map<string, number>,
  parentsOf: (p: Person) => string[],
): Array<{ left: string; right: string }> {
  // Parent group -> its children, with where they hang from (average parent position).
  const families = new Map<number, Array<{ group: number; slot: number; person: Person }>>();
  for (const child of people) {
    const positions = new Map<number, number[]>();
    for (const parentId of parentsOf(child)) {
      const g = groupOf.get(parentId)!;
      if (g === groupOf.get(child.id)) continue;
      positions.set(g, [...(positions.get(g) ?? []), groups[g].indexOf(parentId)]);
    }
    for (const [g, at] of positions) {
      const kids = families.get(g) ?? [];
      kids.push({ group: groupOf.get(child.id)!, slot: at.reduce((a, b) => a + b) / at.length, person: child });
      families.set(g, kids);
    }
  }

  // Group -> groups it must sit left of. `reaches` follows those links transitively.
  const after = new Map<string, Set<string>>();
  const reaches = (from: string, to: string) => {
    const stack = [from];
    const seen = new Set(stack);
    while (stack.length) {
      const id = stack.pop()!;
      if (id === to) return true;
      for (const next of after.get(id) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return false;
  };

  const constraints: Array<{ left: string; right: string }> = [];
  for (const kids of families.values()) {
    kids.sort((a, b) => a.slot - b.slot || byBirthYear(a.person, b.person));
    for (let i = 1; i < kids.length; i++) {
      const left = `g${kids[i - 1].group}`;
      const right = `g${kids[i].group}`;
      if (reaches(right, left)) continue;
      after.set(left, (after.get(left) ?? new Set()).add(right));
      constraints.push({ left, right });
    }
  }
  return constraints;
}

export function layoutTree(people: Person[]): TreeLayout {
  const index = buildIndex(people);
  const { byId } = index;
  const spouses = new Map<string, Set<string>>();
  for (const p of people) {
    for (const s of p.spouseIds) {
      if (s === p.id || !byId.has(s)) continue;
      if (!spouses.has(p.id)) spouses.set(p.id, new Set());
      if (!spouses.has(s)) spouses.set(s, new Set());
      spouses.get(p.id)!.add(s);
      spouses.get(s)!.add(p.id);
    }
  }
  const parentsOf = (p: Person) => [p.fatherId, p.motherId].filter((id): id is string => !!id && byId.has(id));

  const groups = spouseGroups(people, byId, spouses);
  const groupOf = new Map<string, number>();
  groups.forEach((ids, i) => ids.forEach((id) => groupOf.set(id, i)));

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 100, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));
  groups.forEach((ids, i) => {
    graph.setNode(`g${i}`, { width: ids.length * NODE_WIDTH + (ids.length - 1) * SPOUSE_GAP, height: NODE_HEIGHT });
  });
  for (const p of people) {
    for (const parentId of parentsOf(p)) {
      const from = groupOf.get(parentId)!;
      const to = groupOf.get(p.id)!;
      if (from !== to) graph.setEdge(`g${from}`, `g${to}`);
    }
  }
  dagre.layout(graph, { constraints: siblingConstraints(people, groups, groupOf, parentsOf) });

  const nodes: TreeLayout["nodes"] = [];
  const position = new Map<string, { x: number; y: number }>();
  groups.forEach((ids, i) => {
    const { x, y, width } = graph.node(`g${i}`);
    ids.forEach((id, j) => {
      const pos = { x: x - width / 2 + j * (NODE_WIDTH + SPOUSE_GAP), y: y - NODE_HEIGHT / 2 };
      position.set(id, pos);
      nodes.push({
        id,
        type: "person",
        position: pos,
        data: { person: byId.get(id)!, isHead: isFamilyHead(index, id) },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  });

  const edges: BuiltInEdge[] = [];
  const linkEdges = new Map<string, string[]>();
  const unions = new Map<string, { id: string; left: string; stepPosition: number }>();

  // Spouse lines. Neighbours get a small "union" point in the gap that their children hang from.
  for (const ids of groups) {
    const unionCount = ids.length - 1;
    ids.forEach((a, j) => {
      for (const b of spouses.get(a) ?? []) {
        const k = ids.indexOf(b);
        if (k <= j) continue;
        if (k === j + 1) {
          const u = `u:${a}:${b}`;
          const pa = position.get(a)!;
          nodes.push({
            id: u,
            type: "union",
            position: { x: pa.x + NODE_WIDTH + SPOUSE_GAP / 2 - 1, y: pa.y + NODE_HEIGHT / 2 - 1 },
            data: {},
            width: 2,
            height: 2,
            selectable: false,
            focusable: false,
          });
          edges.push({ id: `${u}:a`, source: a, sourceHandle: "r", target: u, targetHandle: "l", type: "straight", style: EDGE_STYLE });
          edges.push({ id: `${u}:b`, source: u, sourceHandle: "r", target: b, targetHandle: "l", type: "straight", style: EDGE_STYLE });
          // With several marriages in a row, each couple's child lines bend at a different height.
          const stepPosition = unionCount > 1 ? 0.3 + (0.4 * j) / (unionCount - 1) : 0.5;
          unions.set(pairKey(a, b), { id: u, left: a, stepPosition });
          linkEdges.set(pairKey(a, b), [`${u}:a`, `${u}:b`]);
        } else {
          // Not neighbours (three or more spouses in a group): arc over the top.
          const id = `s:${a}:${b}`;
          edges.push({ id, source: a, sourceHandle: "ts", target: b, targetHandle: "t", type: "smoothstep", style: EDGE_STYLE });
          linkEdges.set(pairKey(a, b), [id]);
        }
      }
    });
  }

  // Parent to child lines. A child of a couple hangs from the couple's union point.
  for (const child of people) {
    const parents = parentsOf(child);
    const union = parents.length === 2 ? unions.get(pairKey(parents[0], parents[1])) : undefined;
    if (union) {
      const id = `c:${child.id}`;
      edges.push({
        id,
        source: union.id,
        sourceHandle: "b",
        target: child.id,
        targetHandle: "t",
        type: "smoothstep",
        pathOptions: { stepPosition: union.stepPosition },
        style: EDGE_STYLE,
      });
      for (const parentId of parents) {
        linkEdges.set(pairKey(parentId, child.id), [`${union.id}:${parentId === union.left ? "a" : "b"}`, id]);
      }
    } else {
      for (const parentId of parents) {
        const id = `p:${parentId}:${child.id}`;
        edges.push({ id, source: parentId, sourceHandle: "b", target: child.id, targetHandle: "t", type: "smoothstep", style: EDGE_STYLE });
        linkEdges.set(pairKey(parentId, child.id), [id]);
      }
    }
  }

  return { nodes, edges, linkEdges };
}
