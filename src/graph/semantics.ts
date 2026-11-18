import { type Graph, type Link, type Item, neighborhood } from "../model";
export type GraphMode = "hierarchy" | "dependency" | "focus" | "combined";
export interface Visibility {
  blocks: boolean;
  parent: boolean;
  related: boolean;
  grouping: boolean;
}
export const defaultVisibility: Visibility = {
  blocks: true,
  parent: false,
  related: false,
  grouping: false,
};
export function graphProjection(
  g: Graph,
  items: Item[],
  mode: GraphMode,
  visibility: Visibility,
  focus?: string,
  depth = 1,
  direction: "both" | "up" | "down" = "both",
) {
  const visibleIds = new Set(items.map((n) => n.id));
  const participates = (e: Link) => {
    if (mode === "hierarchy" || e.kind === "membership") return false;
    if (mode === "dependency") return e.kind === "blocks";
    if (mode === "focus") return e.kind === "blocks" || e.kind === "parent";
    return visibility[e.kind];
  };
  const candidates = g.links.filter(participates);
  const boundaryIds = new Set(candidates
    .filter(e => visibleIds.has(e.source) || visibleIds.has(e.target))
    .flatMap(e => [e.source, e.target]));
  let nodes = [
    ...items,
    ...g.items.filter((n) => n.kind === "boundary" && boundaryIds.has(n.id)),
  ].filter((n) => n.kind === "issue" || n.kind === "boundary");
  if (mode === "focus") {
    const set = focus ? neighborhood(g, focus, depth, direction) : new Set<string>();
    nodes = nodes.filter((n) => set.has(n.id));
  }
  const ids = new Set(nodes.map((n) => n.id));
  const links = candidates.filter(e => ids.has(e.source) && ids.has(e.target));
  return { nodes, links };
}
export function layoutFingerprint(
  nodes: Item[],
  links: Link[],
  grouped: boolean,
) {
  return JSON.stringify([
    grouped,
    nodes.map((n) => [n.id, n.projectId, n.milestoneId]),
    links
      .filter((e) => e.kind !== "related")
      .map((e) => [e.source, e.target, e.kind]),
  ]);
}
