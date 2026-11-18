import { paginate, directTransport, readScopedIssue, LinearAccessError, type Transport } from "../api";
import type { TeamContext } from "../team/types";
import type { Item } from "../model";
import type { ReviewPolicy } from "../profiles/model";
import {
  calculateReview,
  roundBoundary,
  type ReviewComment,
  type ReviewResult,
} from "./engine";
export async function fetchReview(
  team: TeamContext,
  issue: Item,
  policy: ReviewPolicy,
  transport: Transport = directTransport,
  signal?: AbortSignal,
): Promise<ReviewResult> {
  if (issue.teamId !== team.id) throw new Error("拒绝读取其他团队评论。");
  const request = (operation: string, fields: string, cursor: string | null, thread?: string) =>
    readScopedIssue(operation, fields, team, issue.id, cursor, transport, signal, thread);
  const fields = "id body createdAt updatedAt url parentId documentContentId quotedText user{id name}";
  type RawComment = Omit<ReviewComment, "inline" | "parentId"> & {
    parentId?: string | null;
    documentContentId?: string | null;
    quotedText?: string | null;
    children?: { nodes: { id: string }[] };
  };
  const raw = await paginate<RawComment>(async (cursor) =>
    (await request("ReviewComments",
      `comments(first:100,after:$cursor){nodes{${fields} children(first:1){nodes{id}}}pageInfo{hasNextPage endCursor}}`, cursor)
    ).comments,
  );
  const all = new Map(raw.map((c) => [c.id, c]));
  for (const root of raw) {
    if (root.parentId || root.children?.nodes.length === 0) continue;
    const replies = await paginate<RawComment>(async (cursor) => {
      const node = await request("ReviewReplies",
        `comments(first:1,filter:{id:{eq:$thread}}){nodes{id children(first:100,after:$cursor){nodes{${fields} issue{id team{id}}}pageInfo{hasNextPage endCursor}}}}`,
        cursor, root.id);
      const thread = node.comments?.nodes?.[0];
      if (thread?.id !== root.id) throw new Error("评论线程已更改，请刷新。");
      for (const reply of thread.children.nodes) {
        if (reply.parentId !== root.id || reply.issue?.id !== issue.id || reply.issue?.team?.id !== team.id)
          throw new LinearAccessError("回复 Team 或任务校验失败。");
      }
      return thread.children;
    });
    for (const reply of replies) all.set(reply.id, reply);
  }
  const inline = (id: string): boolean => {
    const seen = new Set<string>();
    let c = all.get(id);
    while (c && !seen.has(c.id)) {
      seen.add(c.id);
      if (c.documentContentId || c.quotedText != null) return true;
      if (!c.parentId) return false;
      c = all.get(c.parentId);
    }
    // A missing ancestor or malformed thread cannot establish a formal comment.
    return true;
  };
  const comments = [...all.values()].map((c) => ({
    ...c, parentId: c.parentId ?? undefined, inline: inline(c.id),
  }));
  let stateId: string | undefined;
  let assigneeId: string | undefined;
  let boundary: string | undefined;
  try {
    const history = await paginate<Parameters<typeof roundBoundary>[0][number]>(async (cursor) => {
      const node = await request("ReviewHistory",
        "state{id} assignee{id} history(first:100,after:$cursor){nodes{createdAt fromStateId toStateId}pageInfo{hasNextPage endCursor}}", cursor);
      if (!node.state?.id || (node.assignee !== null && !node.assignee?.id))
        throw new Error("审阅任务身份数据不完整。");
      if (cursor && (stateId !== node.state.id || assigneeId !== node.assignee?.id))
        throw new Error("任务在读取期间发生变化。");
      stateId = node.state.id;
      assigneeId = node.assignee?.id;
      return node.history;
    });
    boundary = roundBoundary(history, policy.inReviewStateIds);
  } catch (e) {
    signal?.throwIfAborted();
    if (e instanceof LinearAccessError) throw e;
    return {
      ...calculateReview(policy, assigneeId, [], undefined, stateId),
      warning: "状态历史读取失败；无法确认当前审阅轮次。",
    };
  }
  return calculateReview(policy, assigneeId, comments, boundary, stateId);
}
export class ReviewCache {
  private entries = new Map<string, ReviewResult>();
  private generation = 0;
  clear() {
    this.generation++;
    this.entries.clear();
  }
  get(teamId: string, issueId: string) {
    return this.entries.get(`${teamId}:${issueId}`);
  }
  async load(
    team: TeamContext,
    issue: Item,
    policy: ReviewPolicy,
    signal: AbortSignal,
    transport: Transport = directTransport,
  ) {
    const key = `${team.id}:${issue.id}`,
      epoch = this.generation;
    const cached = this.entries.get(key);
    if (cached) return cached;
    const result = await fetchReview(team, issue, policy, transport, signal);
    signal.throwIfAborted();
    if (epoch !== this.generation)
      throw new DOMException("Stale", "AbortError");
    this.entries.set(key, result);
    return result;
  }
}
