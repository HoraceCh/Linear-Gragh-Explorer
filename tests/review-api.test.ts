import { it, expect } from "vitest";
import { fetchReview, ReviewCache } from "../src/review/api";
import type { Transport } from "../src/api";
import { defaultMarkers } from "../src/profiles/model";
const team = { id: "synthetic-team", key: "T", name: "Synthetic" },
  issue = {
    id: "i",
    title: "Synthetic",
    kind: "issue" as const,
    teamId: team.id,
    stateId: "review",
    assigneeId: "owner",
  };
const policy = {
  enabled: true,
  requiredApprovals: 1,
  eligibleReviewerIds: ["r"],
  excludeAssignee: true,
  inReviewStateIds: ["review"],
  markers: defaultMarkers,
};
const conn = (nodes: any[], next: string | null = null) => ({
  nodes,
  pageInfo: { hasNextPage: !!next, endCursor: next },
});
const c = {
  id: "c",
  body: defaultMarkers.approve,
  user: { id: "r", name: "Reviewer" },
  createdAt: "2026-01-03T00:00:00Z",
  updatedAt: "2026-01-03T00:00:00Z",
  documentContentId: null,
  quotedText: null,
};
const scoped = (fields: Record<string, unknown>) => ({ issues: { nodes: [{ id: issue.id, team: {id: team.id}, ...fields }] } });
const fake =
  (comments: any[] = [c]): Transport =>
  async (q, v) => {
    if (q.includes("ReviewComments"))
      return scoped({ comments: v.cursor ? conn(comments) : conn([], "page2") });
    if (q.includes("ReviewReplies"))
      return scoped({ comments: conn([{ id: v.thread, children: conn([]) }]) });
    return scoped({
      state: { id: "review" }, assignee: { id: "owner" },
      history: conn([{
        createdAt: "2026-01-02T00:00:00Z",
        fromStateId: "todo", toStateId: "review",
      }]),
    });
  };
it("paginates comments and verifies real review boundary", async () =>
  expect((await fetchReview(team, issue, policy, fake())).status).toBe(
    "Review Passed",
  ));
it("denies another team before any comment call", async () => {
  let calls = 0;
  await expect(
    fetchReview({ ...team, id: "foreign" }, issue, policy, async () => {
      calls++;
    }),
  ).rejects.toThrow("其他团队");
  expect(calls).toBe(0);
});
it("excludes inline comments", async () =>
  expect(
    (
      await fetchReview(
        team,
        issue,
        policy,
        fake([{ ...c, quotedText: "selected description" }]),
      )
    ).approvals,
  ).toBe(0));
it("unavailable history is uncertain instead of passed", async () => {
  const base = fake();
  expect(
    (
      await fetchReview(team, issue, policy, async (q, v) => {
        if (q.includes("ReviewHistory")) throw Error("denied");
        return base(q, v);
      })
    ).status,
  ).toBe("Verification Required");
});
it("successful cache invalidation removes deleted comments", async () => {
  const cache = new ReviewCache(),
    signal = new AbortController().signal;
  expect(
    (await cache.load(team, issue, policy, signal, fake())).approvals,
  ).toBe(1);
  cache.clear();
  expect(
    (await cache.load(team, issue, policy, signal, fake([]))).approvals,
  ).toBe(0);
});
it("failed comment page never returns passed", async () => {
  await expect(
    fetchReview(team, issue, policy, async () => {
      throw Error("offline");
    }),
  ).rejects.toThrow("offline");
});
it("aborted reply fetch cannot populate cache", async () => {
  const cache = new ReviewCache(),
    controller = new AbortController();
  controller.abort();
  await expect(
    cache.load(team, issue, policy, controller.signal, fake()),
  ).rejects.toThrow();
  expect(cache.get(team.id, issue.id)).toBeUndefined();
});

it("uses current assignee and workflow state for a delayed review read", async () => {
  const provider = fake();
  for (const [field, id, expected] of [
    ["assignee", "r", "Pending"], ["state", "done", "Verification Required"],
  ]) {
    const result = await fetchReview(team, issue, policy, async (q, v) => {
      const data = await provider(q, v);
      if (q.includes("ReviewHistory")) data.issues.nodes[0][field] = { id };
      return data;
    });
    expect(result.status).toBe(expected);
  }
});

it("rejects an issue moved to a different team during history reads", async () => {
  const provider = fake();
  await expect(fetchReview(team, issue, policy, async (q, v) => {
    expect(q).toContain("filter:{id:{eq:$id},team:{id:{eq:$team}}}");
    if (q.includes("ReviewHistory")) return { issues: { nodes: [] } };
    return provider(q, v);
  })).rejects.toThrow("不可访问");
});

it("ignores orphaned replies whose inline ancestry cannot be verified", async () =>
  expect((await fetchReview(team, issue, policy, fake([{ ...c, parentId: "missing" }]))).approvals).toBe(0));

it("reads replies only for threads with children", async () => {
  const provider = fake([{ ...c, children: conn([]) }]);
  let replyRequests = 0;
  await fetchReview(team, issue, policy, async (q,v) => {
    if (q.includes("ReviewReplies")) replyRequests++;
    return provider(q,v);
  });
  expect(replyRequests).toBe(0);
});
