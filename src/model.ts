export const TEAM_KEY = "PVCR";
export type Kind = "project" | "milestone" | "issue";
export type LinkKind = "membership" | "parent" | "blocks" | "related";
export interface Item {
  id: string;
  kind: Kind;
  title: string;
  identifier?: string;
  description?: string;
  url?: string;
  projectId?: string;
  milestoneId?: string;
  parentId?: string;
  teamId?: string;
  assignee?: string;
  status?: string;
  statusType?: string;
  priority?: number;
  archived?: boolean;
}
export interface Link {
  id: string;
  source: string;
  target: string;
  kind: LinkKind;
}
export interface Graph {
  items: Item[];
  links: Link[];
  warnings: string[];
  syncedAt: string;
  source: "live" | "synthetic";
}
export const emptyGraph = (): Graph => ({
  items: [],
  links: [],
  warnings: [],
  syncedAt: "",
  source: "live",
});
export function normalize(
  items: Item[],
  relations: Link[],
  warnings: string[] = [],
  expectedTeamId: string = TEAM_KEY,
): Graph {
  const safe = items.filter((n) => n.kind !== "issue" || n.teamId === expectedTeamId),
    ids = new Set(safe.map((n) => n.id));
  const edges: Link[] = [];
  const notes = [...warnings];
  const add = (source: string, target: string, kind: LinkKind) => {
    if (ids.has(source) && ids.has(target))
      edges.push({ id: `${kind}:${source}:${target}`, source, target, kind });
    else
      notes.push(
        "存在不可用引用（可能已删除、权限变化或位于团队之外）；未展开读取。",
      );
  };
  for (const n of safe) {
    if (n.projectId && n.kind === "milestone")
      add(n.projectId, n.id, "membership");
    if (n.kind === "issue") {
      if (n.milestoneId) add(n.milestoneId, n.id, "membership");
      else if (n.projectId) add(n.projectId, n.id, "membership");
      if (n.parentId) add(n.parentId, n.id, "parent");
    }
  }
  for (const e of relations) add(e.source, e.target, e.kind);
  return {
    items: safe,
    links: [
      ...new Map(
        edges.map((e) => [
          e.kind === "related"
            ? `related:${[e.source, e.target].sort().join(":")}`
            : e.id,
          e,
        ]),
      ).values(),
    ],
    warnings: notes,
    syncedAt: new Date().toISOString(),
    source: "live",
  };
}
export function analyze(g: Graph) {
  const issues = g.items.filter((n) => n.kind === "issue");
  const byId = new Map(g.items.map((n) => [n.id, n]));
  const blocks = g.links.filter((e) => e.kind === "blocks");
  const adj = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const e of blocks) {
    adj.set(e.source, [...(adj.get(e.source) || []), e.target]);
    rev.set(e.target, [...(rev.get(e.target) || []), e.source]);
  }
  // Iterative Kosaraju: no recursive stack overflow on long dependency chains.
  const seen = new Set<string>(),
    order: string[] = [];
  for (const n of issues) {
    if (seen.has(n.id)) continue;
    const stack: [string, boolean][] = [[n.id, false]];
    while (stack.length) {
      const [id, exit] = stack.pop()!;
      if (exit) {
        order.push(id);
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push([id, true]);
      for (const t of adj.get(id) || [])
        if (!seen.has(t)) stack.push([t, false]);
    }
  }
  const done = new Set<string>(),
    cycles: string[][] = [];
  for (const id of order.reverse()) {
    if (done.has(id)) continue;
    const group: string[] = [],
      stack = [id];
    done.add(id);
    while (stack.length) {
      const v = stack.pop()!;
      group.push(v);
      for (const t of rev.get(v) || [])
        if (!done.has(t)) {
          done.add(t);
          stack.push(t);
        }
    }
    if (
      group.length > 1 ||
      blocks.some((e) => e.source === id && e.target === id)
    )
      cycles.push(group);
  }
  const taskEdges = g.links.filter((e) => e.kind !== "membership");
  const touched = new Set(taskEdges.flatMap((e) => [e.source, e.target]));
  const blocked = new Set(
    blocks
      .filter(
        (e) =>
          !["completed", "canceled"].includes(
            byId.get(e.source)?.statusType || "",
          ),
      )
      .map((e) => e.target),
  );
  return {
    cycles,
    isolated: issues.filter((n) => !touched.has(n.id)).map((n) => n.id),
    blocked,
    archived: issues.filter((n) => n.archived).length,
  };
}
export function neighborhood(
  g: Graph,
  id: string,
  depth: number,
  direction: "both" | "up" | "down" = "both",
) {
  const seen = new Set([id]);
  let frontier = [id];
  const edges = g.links.filter(
    (e) => e.kind === "blocks" || e.kind === "parent",
  );
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const v of frontier)
      for (const e of edges) {
        const target =
          direction !== "up" && e.source === v
            ? e.target
            : direction !== "down" && e.target === v
              ? e.source
              : null;
        if (target && !seen.has(target)) {
          seen.add(target);
          next.push(target);
        }
      }
    frontier = next;
  }
  return seen;
}
