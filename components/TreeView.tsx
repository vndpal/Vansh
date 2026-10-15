"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStoreApi,
  type BuiltInEdge,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { NODE_HEIGHT, NODE_WIDTH, type PersonNode, type TreeLayout } from "@/lib/layout";
import { genderStyle, HEAD_HINT, HeadTag } from "./person-style";

export interface Highlight {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  /** Set when the highlight is one head's family. */
  headId?: string;
}

// Zero-size, invisible handles so lines meet exactly at the card edge or union point.
const hiddenHandle = { opacity: 0, pointerEvents: "none" as const, width: 0, height: 0, minWidth: 0, minHeight: 0, border: 0 };

function PersonCard({ data }: NodeProps<PersonNode>) {
  const { person, isHead, state = "normal" } = data;
  const { border, tint } = genderStyle[person.gender];
  return (
    <div
      style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
      title={isHead ? HEAD_HINT : undefined}
      className={`relative flex cursor-pointer flex-col justify-center rounded-lg border-2 px-2 text-center shadow-sm transition-opacity ${border} ${
        state === "highlight" ? "bg-amber-50 ring-4 ring-amber-400" : tint
      } ${state === "dim" ? "opacity-25" : ""}`}
    >
      <Handle type="target" position={Position.Top} id="t" style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Top} id="ts" style={hiddenHandle} isConnectable={false} />
      <Handle type="target" position={Position.Left} id="l" style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="r" style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="b" style={hiddenHandle} isConnectable={false} />
      {isHead && <HeadTag className="absolute -top-2 left-2" />}
      <div className="truncate text-sm font-semibold text-slate-900">{person.name}</div>
      {person.birthYear !== undefined && <div className="text-xs text-slate-500">b. {person.birthYear}</div>}
    </div>
  );
}

function UnionPoint() {
  return (
    <div style={{ width: 2, height: 2 }}>
      <Handle type="target" position={Position.Left} id="l" style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Right} id="r" style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} id="b" style={hiddenHandle} isConnectable={false} />
    </div>
  );
}

const nodeTypes: NodeTypes = { person: PersonCard, union: UnionPoint };

interface Props {
  layout: TreeLayout;
  highlight: Highlight | null;
  onSelect: (id: string) => void;
}

const MIN_READABLE_ZOOM = 0.6;

function Flow({ layout, highlight, onSelect }: Props) {
  const { fitView, setViewport } = useReactFlow();
  const store = useStoreApi();

  const nodes = useMemo(
    () =>
      layout.nodes.map((node) =>
        node.type === "person" && highlight
          ? { ...node, data: { ...node.data, state: highlight.nodeIds.has(node.id) ? ("highlight" as const) : ("dim" as const) } }
          : node,
      ),
    [layout, highlight],
  );

  const edges = useMemo<BuiltInEdge[]>(
    () =>
      highlight
        ? layout.edges.map((edge) =>
            highlight.edgeIds.has(edge.id)
              ? { ...edge, zIndex: 1, style: { stroke: "#d97706", strokeWidth: 3 } }
              : { ...edge, style: { ...edge.style, opacity: 0.15 } },
          )
        : layout.edges,
    [layout, highlight],
  );

  // Bring the highlighted path into view (after the panel has resized the canvas).
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => {
      fitView({ nodes: [...highlight.nodeIds].map((id) => ({ id })), padding: 0.2, duration: 400, maxZoom: 1.2 });
    }, 50);
    return () => clearTimeout(timer);
  }, [highlight, fitView]);

  // Opening view: the whole tree if it fits at a readable size, otherwise the oldest
  // generation at a readable zoom (pan and pinch to explore the rest).
  function showStart() {
    const people = layout.nodes.filter((n) => n.type === "person");
    if (people.length === 0) return;
    const { width, height } = store.getState();
    const xs = people.map((n) => n.position.x);
    const ys = people.map((n) => n.position.y);
    const minY = Math.min(...ys);
    const fitZoom = Math.min(
      width / (Math.max(...xs) - Math.min(...xs) + NODE_WIDTH + 80),
      height / (Math.max(...ys) - minY + NODE_HEIGHT + 80),
    );
    if (fitZoom >= MIN_READABLE_ZOOM) {
      fitView({ maxZoom: 1, padding: 0.1 });
      return;
    }
    const top = people.filter((n) => n.position.y < minY + 1).map((n) => n.position.x);
    const centerX = (Math.min(...top) + Math.max(...top) + NODE_WIDTH) / 2;
    const zoom = 0.8;
    setViewport({ x: width / 2 - centerX * zoom, y: 64 - minY * zoom, zoom });
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => node.type === "person" && onSelect(node.id)}
      onInit={showStart}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      onlyRenderVisibleElements
      minZoom={0.02}
      maxZoom={2}
    >
      <Background />
      <Controls showInteractive={false} fitViewOptions={{ padding: 0.05 }} />
    </ReactFlow>
  );
}

export default function TreeView(props: Props) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
