import { type Graph, type Item, neighborhood, analyze } from "../model";
export const isActive = (n: Item) =>
  n.kind === "issue" &&
  !n.archived &&
  !["completed", "canceled"].includes(n.statusType || "");
export function summarize(items: Item[]) {
  const issues = items.filter((n) => n.kind === "issue" && !n.archived);
  const completed = issues.filter((n) => n.statusType === "completed").length,
    canceled = issues.filter((n) => n.statusType === "canceled").length;
  return {
    total: issues.length,
    completed,
    canceled,
    remaining: issues.length - completed - canceled,
    active: issues.filter(isActive).length,
    ratio: issues.length ? completed / issues.length : null,
    unassigned: issues.filter((n) => isActive(n) && !n.assigneeId).length,
    overdue: issues.filter(
      (n) =>
        isActive(n) &&
        n.dueDate &&
        n.dueDate < new Date().toISOString().slice(0, 10),
    ).length,
    states: Object.entries(
      issues.reduce(
        (r, n) => (
          (r[n.status || "未知"] = (r[n.status || "未知"] || 0) + 1),
          r
        ),
        {} as Record<string, number>,
      ),
    ),
  };
}
export function dependencyImpact(g: Graph, id: string) {
  const only = { ...g, links: g.links.filter((e) => e.kind === "blocks") };
  return {
    direct: g.links
      .filter((e) => e.kind === "blocks" && e.target === id)
      .map((e) => e.source),
    upstream: [...neighborhood(only, id, g.items.length, "up")].filter(
      (x) => x !== id,
    ),
    downstream: [...neighborhood(only, id, g.items.length, "down")].filter(
      (x) => x !== id,
    ),
    blocked: analyze(g).blocked.has(id),
  };
}
