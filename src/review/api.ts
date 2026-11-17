import { paginate, directTransport, type Transport } from "../api";
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
  const request = async (q: string, v: Record<string, unknown>) => {
    signal?.throwIfAborted();
    const data = await transport(q, v, signal);
    if (data.issue?.team?.id !== team.id)
      throw new Error("评论 Team 校验失败。");
    return data.issue;
  };
  const raw: any[] = await paginate(
    async (cursor) =>
      (
        await request(
          "query ReviewComments($id:String!,$cursor:String){issue(id:$id){team{id} comments(first:100,after:$cursor){nodes{id body createdAt updatedAt url parentId documentContentId quotedText user{id name}}pageInfo{hasNextPage endCursor}}}}",
          { id: issue.id, cursor },
        )
      ).comments,
  );
  // Follow only comment thread children already attached to a validated issue. Verify every child issue ID.
  const all = new Map(raw.map((c) => [c.id, c]));
  let queue = raw.filter((c) => !c.parentId);
  while (queue.length) {
    const c = queue.shift()!;
    const children: any[] = await paginate(async (cursor) => {
      const data = await transport(
        "query ReviewReplies($id:String!,$cursor:String){comment(id:$id){issue{id team{id}} children(first:100,after:$cursor){nodes{id body createdAt updatedAt url parentId documentContentId quotedText user{id name} issue{id team{id}}}pageInfo{hasNextPage endCursor}}}}",
        { id: c.id, cursor },
        signal,
      );
      if (
        data.comment?.issue?.id !== issue.id ||
        data.comment?.issue?.team?.id !== team.id
      )
        throw new Error("回复边界校验失败。");
      return data.comment.children;
    });
    for (const child of children) {
      if (child.issue?.id !== issue.id || child.issue?.team?.id !== team.id)
        throw new Error("回复 Team 校验失败。");
      if (!all.has(child.id)) {
        all.set(child.id, child);
      }
    }
  }
  const inline = (id: string): boolean => {
    const seen = new Set<string>();
    let c = all.get(id);
    while (c && !seen.has(c.id)) {
      seen.add(c.id);
      if (c.documentContentId || c.quotedText != null) return true;
      c = all.get(c.parentId);
    }
    return false;
  };
  const comments: ReviewComment[] = [...all.values()].map((c) => ({
    ...c,
    inline: inline(c.id),
  }));
  let boundary: string | undefined;
  try {
    const history: any[] = await paginate(
      async (cursor) =>
        (
          await request(
            "query ReviewHistory($id:String!,$cursor:String){issue(id:$id){team{id} history(first:100,after:$cursor){nodes{createdAt fromStateId toStateId}pageInfo{hasNextPage endCursor}}}}",
            { id: issue.id, cursor },
          )
        ).history,
    );
    boundary = roundBoundary(history, policy.inReviewStateIds);
  } catch (e) {
    signal?.throwIfAborted();
    return {
      ...calculateReview(
        policy,
        issue.assigneeId,
        comments,
        undefined,
        issue.stateId,
      ),
      warning: "状态历史读取失败；无法确认当前审阅轮次。",
    };
  }
  return calculateReview(
    policy,
    issue.assigneeId,
    comments,
    boundary,
    issue.stateId,
  );
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
