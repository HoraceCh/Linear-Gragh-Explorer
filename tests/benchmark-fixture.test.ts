import { expect, it } from "vitest";
import { scaleGraph } from "../src/demo";
import { graphProjection, defaultVisibility } from "../src/graph/semantics";

it("separates task relations from membership for the multi-project 200-node fixture", () => {
  const graph = scaleGraph(200);
  const issues = graph.items.filter((item) => item.kind === "issue");
  const milestones = new Map(graph.items.filter((item) => item.kind === "milestone").map((item) => [item.id, item.projectId]));
  expect(graph.source).toBe("synthetic");
  expect(issues).toHaveLength(200);
  expect(new Set(issues.map((item) => item.projectId)).size).toBe(4);
  expect(issues.every((item) => milestones.get(item.milestoneId!) === item.projectId)).toBe(true);
  const projected = graphProjection(graph, issues, "dependency", defaultVisibility);
  expect(projected.links).toHaveLength(600);
  expect(graph.links.filter((edge) => edge.kind === "related")).toHaveLength(200);
  const taskIds = new Set(issues.map((item) => item.id));
  expect(projected.links.every((edge) => taskIds.has(edge.source) && taskIds.has(edge.target))).toBe(true);
});
