import { it, expect } from "vitest";
import {
  graphProjection,
  defaultVisibility,
  layoutFingerprint,
} from "../src/graph/semantics";
import { normalize, type Item, type Link } from "../src/model";
import { dependencyImpact, summarize } from "../src/analytics";
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
});
it("focus starts with direct neighbors", () => {
  const g = dense(20, 100);
  expect(
    graphProjection(g, g.items, "focus", defaultVisibility, "5", 1)
      .nodes.map((n) => n.id)
      .sort(),
  ).toEqual(["4", "5", "6"]);
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
