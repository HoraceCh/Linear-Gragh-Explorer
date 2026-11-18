import { MarkerType, type Edge, type Node } from "@xyflow/react";
import type { Link, Item } from "../model";

export interface RoutePoint { x: number; y: number }

// Layout finishes asynchronously. Never render outgoing cards with missing current data.
export function currentLayoutNodes(nodes: Node[], items: Item[], grouped: boolean): Node[] {
  const byId = new Map(items.map((n) => [n.id, n]));
  return nodes.filter((n) => n.type === "group" ? grouped : byId.has(n.id))
    .map((n) => ({ ...n, data: { ...n.data, item: byId.get(n.id) } }));
}

// Visibility is independent of layout: related links can toggle without moving nodes.
export function renderEdges(links: Link[], routes?: Map<string, RoutePoint[]>): Edge[] {
  return links.map((e) => ({
    id: e.id, source: e.source, target: e.target, type: "routed",
    data: {
      points: routes?.get(e.id),
      kind: e.kind === "blocks" ? "阻塞 →" : e.kind === "parent" ? "父子 →" : "一般相关",
    },
    markerEnd: e.kind === "related" ? undefined : {
      type: MarkerType.ArrowClosed,
      color: e.kind === "blocks" ? "#d5864e" : "#9273d1",
    },
    style: {
      stroke: e.kind === "blocks" ? "#d5864e" : e.kind === "parent" ? "#9273d1" : "#8794a6",
      strokeWidth: 1.7,
      strokeDasharray: e.kind === "related" ? "6 5" : undefined,
    },
  }));
}
