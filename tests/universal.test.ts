import { describe, it, expect } from "vitest";
import {
  discoverTeams,
  syncGraph,
  boundedMap,
  type Transport,
} from "../src/api";
import { TeamSession } from "../src/team/session";
import { defaultProfile, validateProfile } from "../src/profiles/model";
const team = { id: "synthetic-a", key: "A", name: "Team A" };
const conn = (nodes: any[], next: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: !!next, endCursor: next },
});
function transportFor(id = team.id, items: any[] = []): Transport {
  return async (q, v) => {
    if (q.includes("TeamPermission"))
      return { team: { id, key: team.key, name: team.name } };
    if (q.includes("Projects")) return { team: { projects: conn([]) } };
    if (q.includes("Issues")) return { issues: conn(items) };
    if (q.includes("TeamMetadata")) {
      const field = q.includes("members(")
        ? "members"
        : q.includes("states(")
          ? "states"
          : "labels";
      return {
        team: {
          [field]: conn(
            field === "states"
              ? [{ id: "custom-state", name: "Analysis", type: "started" }]
              : [],
          ),
        },
      };
    }
    if (q.includes("Relations"))
      return {
        issue: {
          [q.includes("inverseRelations") ? "inverseRelations" : "relations"]:
            conn([]),
        },
      };
    if (q.includes("IssueLabels")) return { issue: { labels: conn([]) } };
    throw Error(q);
  };
}
describe("universal team engine", () => {
  it("supports no teams", async () =>
    expect(await discoverTeams(async () => ({ teams: conn([]) }))).toEqual([]));
  it("discovers one team", async () =>
    expect(await discoverTeams(async () => ({ teams: conn([team]) }))).toEqual([
      team,
    ]));
  it("paginates multiple teams", async () =>
    expect(
      (
        await discoverTeams(async (_, v) => ({
          teams: v.cursor ? conn([{ ...team, id: "b" }]) : conn([team], "next"),
        }))
      ).length,
    ).toBe(2));
  it("empty team still provides statuses and metadata", async () => {
    const g = await syncGraph(team, transportFor());
    expect(g.items).toEqual([]);
    expect(g.states?.[0].name).toBe("Analysis");
    expect(g.teamId).toBe(team.id);
  });
  it("uses selected ID for all scoped queries", async () => {
    const calls: Record<string, unknown>[] = [];
    const base = transportFor();
    await syncGraph(team, async (q, v, s) => {
      calls.push(v);
      return base(q, v, s);
    });
    expect(calls.every((v) => v.id === team.id || v.team === team.id)).toBe(
      true,
    );
  });
  it("rejects unauthorized team before fetching contents", async () =>
    await expect(syncGraph(team, transportFor("foreign"))).rejects.toThrow(
      "无权",
    ));
  it("rejects foreign returned issues", async () =>
    await expect(
      syncGraph(
        team,
        transportFor(team.id, [{ id: "issue", team: { id: "foreign" } }]),
      ),
    ).rejects.toThrow("Team"));
  it("throws on partial metadata failure instead of returning partial snapshot", async () => {
    const base = transportFor();
    await expect(
      syncGraph(team, async (q, v) => {
        if (q.includes("TeamMetadata")) throw Error("offline");
        return base(q, v);
      }),
    ).rejects.toThrow("offline");
  });
  it("switch cancels old requests and blocks stale writes even when fetch ignores abort", () => {
    const s = new TeamSession();
    const a = s.switch();
    const b = s.switch();
    expect(a.signal.aborted).toBe(true);
    expect(a.current()).toBe(false);
    expect(b.current()).toBe(true);
    s.clear();
    expect(b.current()).toBe(false);
  });
  it("supports independently configured profiles", () => {
    const a = defaultProfile("a", "A"),
      b = defaultProfile("b", "B");
    a.roles.push({ id: "r", name: "Research" });
    expect(b.roles).toEqual([]);
    expect(() => validateProfile(a, "b")).toThrow();
  });
  it("profile import discards token and snapshot fields", () => {
    const p = validateProfile(
      {
        ...defaultProfile("a", "A"),
        access_token: "synthetic",
        issues: [{ title: "private" }],
      },
      "a",
    );
    expect(JSON.stringify(p)).not.toContain("access_token");
    expect(JSON.stringify(p)).not.toContain("private");
  });
  it("validates profile roles and review quota", () => {
    expect(() =>
      validateProfile(
        { ...defaultProfile("a", "A"), roles: [{ id: "a", name: 7 }] },
        "a",
      ),
    ).toThrow();
  });
  it("bounds concurrency", async () => {
    let active = 0,
      max = 0;
    const result = await boundedMap(
      Array.from({ length: 50 }, (_, i) => i),
      3,
      async (i) => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 1));
        active--;
        return i;
      },
    );
    expect(max).toBe(3);
    expect(result.length).toBe(50);
  });
  it("honors pre-aborted work", async () => {
    const c = new AbortController();
    c.abort();
    let calls = 0;
    await expect(
      boundedMap(
        [1, 2],
        2,
        async () => {
          calls++;
          return 1;
        },
        c.signal,
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});

it.each(["SelectedTeamRelations", "IssueLabels"])("rechecks selected team on every %s page", async (operation) => {
  const base = transportFor(team.id, [{id: "issue", title: "Synthetic", team: {id: team.id}}]);
  await expect(syncGraph(team, async (q, v) => {
    if (/query (SelectedTeamRelations|IssueLabels)/.test(q)) {
      expect(q).toContain("team:{id:{eq:$team}}");
      return { issues: {nodes: [{ id: "issue", team: {id: q.includes(operation) ? "foreign" : team.id},
        relations: conn([]), inverseRelations: conn([]), labels: conn([]) }]} };
    }
    return base(q, v);
  })).rejects.toThrow("Team");
});

it("rejects a profile with three arbitrary marker keys", () => {
  const p = defaultProfile(team.id, team.key);
  expect(() => validateProfile({ ...p, reviewPolicy: {
    enabled: true, requiredApprovals: 1, eligibleReviewerIds: ["r"], excludeAssignee: true,
    inReviewStateIds: ["review"], markers: {wrong: "[REVIEW: YES]", hold: "[REVIEW: HOLD]", requestChanges: "[REVIEW: NO]"},
  } }, team.id)).toThrow("审阅策略");
});
