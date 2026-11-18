import { it, expect } from "vitest";
import {
  graphProjection,
  defaultVisibility,
  layoutFingerprint,
} from "../src/graph/semantics";
import { normalize, type Item, type Link } from "../src/model";
import { dependencyImpact, summarize } from "../src/analytics";
import { renderEdges, currentLayoutNodes } from "../src/graph/edges";
import { scaleGraph } from "../src/demo";
function dense(n: number, related: number) {
  const items: Item[] = Array.from({ length: n }, (_, i) => ({
    id: String(i),
    kind: "issue",
    title: `Synthetic task ${i}`,
    teamId: "synthetic-team",
    projectId: "p",
    milestoneId: "m",
  }));
  const links: Link[] = items.slice(1).map((_, i) => ({
    id: `b${i}`,
    source: String(i),
    target: String(i + 1),
    kind: "blocks",
  }));
  for (let i = 0; i < related; i++)
    links.push({
      id: `r${i}`,
      source: String(i % n),
      target: String((i * 7 + 3) % n),
      kind: "related",
    });
  return normalize(items, links, [], "synthetic-team");
}
it.each([[20, 100], [50, 200], [100, 500]] as const)("visual fixture %i has %i task relationships", (count, relations) => {
  const g = scaleGraph(count);
  expect(g.source).toBe("synthetic");
  expect(g.items.filter((n) => n.kind === "issue")).toHaveLength(count);
  expect(g.links.filter((e) => e.kind === "blocks" || e.kind === "related")).toHaveLength(relations);
});
it.each([
  [20, 100],
  [50, 200],
  [100, 500],
])(
  "dense %i graph keeps all data but defaults to genuine dependencies",
  (n, r) => {
    const g = dense(n, r),
      before = g.links.length;
    const p = graphProjection(g, g.items, "dependency", defaultVisibility);
    expect(p.nodes.length).toBe(n);
    expect(p.links.length).toBe(n - 1);
    expect(p.links.every((e) => e.kind === "blocks")).toBe(true);
    expect(g.links.length).toBe(before);
  },
);
it("hierarchy renders no membership or dependency edges", () => {
  const g = dense(20, 100);
  expect(
    graphProjection(g, g.items, "hierarchy", defaultVisibility).links,
  ).toEqual([]);
});
it("combined toggles expose related without losing underlying links", () => {
  const g = dense(20, 100);
  const base = graphProjection(g, g.items, "combined", defaultVisibility);
  const all = graphProjection(g, g.items, "combined", {
    ...defaultVisibility,
    related: true,
  });
  expect(all.links.length).toBeGreaterThan(base.links.length);
  expect(layoutFingerprint(base.nodes, base.links, false)).toBe(
    layoutFingerprint(all.nodes, all.links, false),
  );
  const before = renderEdges(base.links);
  const after = renderEdges(all.links);
  expect(after.length).toBeGreaterThan(before.length);
  for (const edge of after.filter((e) => all.links.find((l) => l.id === e.id)?.kind === "related")) {
    expect(edge.markerEnd).toBeUndefined();
    expect(edge.style?.strokeDasharray).toBe("6 5");
  }
});
it("rendered dependencies retain ELK sections and can be removed without recomputing routes", () => {
  const link: Link = { id: "block", source: "a", target: "b", kind: "blocks" };
  const points = [{x: 280, y: 82}, {x: 400, y: 82}];
  const routes = new Map([[link.id, points]]);
  expect(renderEdges([link], routes)[0].data?.points).toEqual(points);
  expect(renderEdges([], routes)).toEqual([]);
});
it("focus starts with direct neighbors", () => {
  const g = dense(20, 100);
  expect(graphProjection(g, g.items, "focus", defaultVisibility).nodes).toEqual([]);
  expect(
    graphProjection(g, g.items, "focus", defaultVisibility, "5", 1)
      .nodes.map((n) => n.id)
      .sort(),
  ).toEqual(["4", "5", "6"]);
});
it("async focus/filter transition never renders outgoing cards with undefined data", () => {
  const g = dense(20, 100);
  const oldLayout = g.items.map((n) => ({ id: n.id, type: "card", position: {x: 0, y: 0}, data: {item:n} }));
  const focused = graphProjection(g, g.items, "focus", defaultVisibility, "5", 1);
  const displayed = currentLayoutNodes(oldLayout, focused.nodes, false);
  expect(displayed.map((n) => n.id).sort()).toEqual(["4", "5", "6"]);
  expect(displayed.every((n) => n.data.item !== undefined)).toBe(true);
  expect(currentLayoutNodes(oldLayout, [], false)).toEqual([]);
  const edited = focused.nodes.map((n) => ({...n, title:"Updated", status:"Done"}));
  expect(currentLayoutNodes(oldLayout, edited, false).every((n) => (n.data.item as Item).title === "Updated")).toBe(true);
});
it("layout identity does not depend on detail selection, text or status", () => {
  const g = dense(20, 100);
  const a = layoutFingerprint(g.items, g.links, false);
  expect(
    layoutFingerprint(
      g.items.map((n) => ({ ...n, title: "edited", status: "new" })),
      g.links,
      false,
    ),
  ).toBe(a);
  expect(layoutFingerprint(g.items.slice(1), g.links, false)).not.toBe(a);
});
it("transitive impact ignores related edges", () => {
  const g = dense(20, 100);
  expect(dependencyImpact(g, "5").upstream).toHaveLength(5);
  expect(dependencyImpact(g, "5").downstream).toHaveLength(14);
});
it("no progress is invented for empty project", () =>
  expect(summarize([]).ratio).toBeNull());

it.each([20, 50, 100])(
  "ELK produces routed dependency sections for %i-node DAG",
  async (n) => {
    const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
    const { dependencyLayoutInput } = await import("../src/graph/layout");
    const g = dense(n, n * 5),
      input = dependencyLayoutInput(g.items, g.links),
      output = await new ELK().layout(input);
    const positions = new Map(output.children?.map((c) => [c.id, c.x || 0]));
    for (const e of output.edges || []) {
      expect(e.sections?.[0].startPoint).toBeDefined();
      expect(e.sections?.[0].endPoint).toBeDefined();
      expect(positions.get(e.sources[0])!).toBeLessThan(
        positions.get(e.targets[0])!,
      );
    }
  },
  15000,
);

it("shows an anonymous endpoint only when its relationship type is visible", () => {
  const task = {id:"local", kind:"issue" as const, title:"Local"};
  const boundary = {id:"boundary:1", kind:"boundary" as const, title:"External"};
  const graph = {items:[task,boundary], links:[{id:"r",source:task.id,target:boundary.id,kind:"related" as const}],warnings:[],syncedAt:"",source:"synthetic" as const};
  const visibility = {blocks:true, parent:false, related:false, grouping:false};
  expect(graphProjection(graph,[task],"dependency",visibility).nodes).toEqual([task]);
  expect(graphProjection(graph,[task],"combined",{...visibility,related:true}).nodes).toEqual([task,boundary]);
});
