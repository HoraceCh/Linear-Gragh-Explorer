import { describe, it, expect } from "vitest";
import {
  normalize,
  analyze,
  neighborhood,
  TEAM_KEY,
  type Item,
  type Link,
} from "../src/model";
import { paginate, syncGraph } from "../src/api";
const item = (id: string, extra: Partial<Item> = {}): Item => ({
  id,
  kind: "issue",
  teamId: TEAM_KEY,
  title: id,
  ...extra,
});
const edge = (s: string, t: string, kind: Link["kind"] = "blocks"): Link => ({
  id: s + t + kind,
  source: s,
  target: t,
  kind,
});
describe("graph semantics", () => {
  it("blocks direction and completed prerequisites", () => {
    const g = normalize(
      [item("a"), item("b"), item("c", { statusType: "completed" })],
      [edge("a", "b"), edge("c", "a")],
    );
    expect([...analyze(g).blocked]).toEqual(["b"]);
    expect([...neighborhood(g, "a", 1, "down")]).toEqual(["a", "b"]);
  });
  it("cycles only use blocks", () => {
    expect(
      analyze(
        normalize(
          [item("a"), item("b")],
          [edge("a", "b"), edge("b", "a", "related")],
        ),
      ).cycles,
    ).toHaveLength(0);
    expect(
      analyze(
        normalize([item("a"), item("b")], [edge("a", "b"), edge("b", "a")]),
      ).cycles,
    ).toHaveLength(1);
  });
  it("rejects foreign issues and does not follow foreign references", () => {
    const g = normalize(
      [item("a"), item("secret", { teamId: "other" })],
      [edge("secret", "a")],
    );
    expect(g.items).toHaveLength(1);
    expect(g.links).toHaveLength(0);
    expect(g.warnings).toHaveLength(1);
  });
  it("keeps project, milestone and parent relationships distinct", () => {
    const g = normalize(
      [
        { id: "p", title: "p", kind: "project" },
        { id: "m", title: "m", kind: "milestone", projectId: "p" },
        item("a", { projectId: "p", milestoneId: "m" }),
        item("b", { parentId: "a" }),
      ],
      [],
    );
    expect(g.links.map((e) => e.kind)).toEqual([
      "membership",
      "membership",
      "parent",
    ]);
    expect(analyze(g).blocked.size).toBe(0);
  });
  it("missing references are unknown rather than declared deleted", () =>
    expect(
      normalize([item("a", { parentId: "missing" })], []).warnings[0],
    ).toContain("可能"));
  it("deduplicates incoming and outgoing representations", () =>
    expect(
      normalize([item("a"), item("b")], [edge("a", "b"), edge("a", "b")]).links,
    ).toHaveLength(1));
  it("empty projects remain discoverable", () =>
    expect(
      analyze(normalize([{ id: "p", title: "empty", kind: "project" }], []))
        .isolated,
    ).toHaveLength(0));
  it("handles a 10000 node dependency chain without recursion", () => {
    const items = Array.from({ length: 10000 }, (_, i) => item(String(i)));
    const edges = items.slice(1).map((_, i) => edge(String(i), String(i + 1)));
    const a = analyze(normalize(items, edges));
    expect(a.cycles).toHaveLength(0);
    expect(a.blocked.size).toBe(9999);
  });
});
describe("data boundaries", () => {
  it("consumes all pages", async () => {
    let calls = 0;
    const r = await paginate(async (c) => {
      calls++;
      return {
        nodes: [calls],
        pageInfo: {
          hasNextPage: c === null,
          endCursor: c === null ? "next" : null,
        },
      };
    });
    expect(r).toEqual([1, 2]);
  });
  it("detects repeated cursors", async () => {
    await expect(
      paginate(async () => ({
        nodes: [],
        pageInfo: { hasNextPage: true, endCursor: "same" },
      })),
    ).rejects.toThrow("游标");
  });
  it("stops immediately for denied team access", async () => {
    let calls = 0;
    await expect(
      syncGraph(async () => {
        calls++;
        return { team: null };
      }),
    ).rejects.toThrow("无权");
    expect(calls).toBe(1);
  });
  it("never returns a partially loaded snapshot", async () => {
    let calls = 0;
    await expect(
      syncGraph(async () => {
        calls++;
        if (calls === 1) return { teams: { nodes: [{ id: "synthetic-team-id", key: TEAM_KEY }] } };
        throw new Error("offline");
      }),
    ).rejects.toThrow("offline");
  });
});
