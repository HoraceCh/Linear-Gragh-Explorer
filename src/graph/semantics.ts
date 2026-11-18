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
  const boundaryIds = new Set(
    g.links
      .filter((e) => visibleIds.has(e.source) || visibleIds.has(e.target))
      .flatMap((e) => [e.source, e.target]),
  );
  let nodes = [
    ...items,
    ...g.items.filter((n) => n.kind === "boundary" && boundaryIds.has(n.id)),
  ].filter((n) => n.kind === "issue" || n.kind === "boundary");
  if (mode === "focus") {
    const set = focus ? neighborhood(g, focus, depth, direction) : new Set<string>();
    nodes = nodes.filter((n) => set.has(n.id));
  }
  const ids = new Set(nodes.map((n) => n.id));
  const links = g.links.filter(
    (e) =>
      ids.has(e.source) &&
      ids.has(e.target) &&
      (mode === "dependency"
        ? e.kind === "blocks"
        : mode === "focus"
          ? e.kind === "blocks" || e.kind === "parent"
          : mode === "hierarchy"
            ? false
            : e.kind === "blocks"
              ? visibility.blocks
              : e.kind === "parent"
                ? visibility.parent
                : e.kind === "related"
                  ? visibility.related
                  : false),
  );
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
