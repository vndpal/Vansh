// Turns the people list into React Flow nodes and edges laid out top-down with dagre.
// Spouses are grouped into one dagre node so they always sit side by side.
import dagre from "@dagrejs/dagre";
import type { BuiltInEdge, Node } from "@xyflow/react";
import type { Person } from "./types";

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 56;
const SPOUSE_GAP = 32;
const EDGE_STYLE = { stroke: "#94a3b8", strokeWidth: 1.5 };

export type NodeState = "normal" | "highlight" | "dim";
export type PersonNode = Node<{ person: Person; state?: NodeState }, "person">;
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
      // Walk from someone with the fewest spouses so remarriage chains stay in order.
      const order: string[] = [];
      const visit = (id: string) => {
        order.push(id);
        for (const s of spouses.get(id) ?? []) if (!order.includes(s)) visit(s);
      };
      visit(group.reduce((a, b) => ((spouses.get(b)?.size ?? 0) < (spouses.get(a)?.size ?? 0) ? b : a)));
      groups.push(order);
    } else {
      groups.push(group);
    }
  }
  return groups;
}

export function layoutTree(people: Person[]): TreeLayout {
  const byId = new Map(people.map((p) => [p.id, p]));
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
  dagre.layout(graph);

  const nodes: TreeLayout["nodes"] = [];
  const position = new Map<string, { x: number; y: number }>();
  groups.forEach((ids, i) => {
    const { x, y, width } = graph.node(`g${i}`);
    ids.forEach((id, j) => {
      const pos = { x: x - width / 2 + j * (NODE_WIDTH + SPOUSE_GAP), y: y - NODE_HEIGHT / 2 };
      position.set(id, pos);
      nodes.push({ id, type: "person", position: pos, data: { person: byId.get(id)! }, width: NODE_WIDTH, height: NODE_HEIGHT });
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
