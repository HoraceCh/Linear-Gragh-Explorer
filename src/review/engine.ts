import type { ReviewPolicy } from "../profiles/model";
export type Decision = "approve" | "requestChanges" | "hold";
export type ReviewStatus =
  | "Not Configured"
  | "Verification Required"
  | "Pending"
  | "Partially Approved"
  | "Review Passed"
  | "Changes Requested"
  | "On Hold";
export interface ReviewComment {
  id: string;
  body: string;
  user?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  url?: string;
  inline: boolean;
  parentId?: string;
}
export interface ReviewResult {
  status: ReviewStatus;
  approvals: number;
  required: number;
  decisions: {
    reviewerId: string;
    name: string;
    decision: Decision;
    at: string;
    excerpt: string;
    url?: string;
  }[];
  boundary?: string;
  warning?: string;
}
export const reviewLabels: Record<ReviewStatus, string> = {
  "Not Configured": "未配置",
  "Verification Required": "需要核验",
  Pending: "待审阅",
  "Partially Approved": "部分批准",
  "Review Passed": "审阅通过",
  "Changes Requested": "要求修改",
  "On Hold": "暂缓",
};
export function parseMarker(
  body: string,
  markers: ReviewPolicy["markers"],
): Decision | null {
  let fence: { char: string; length: number } | null = null;
  const found: Decision[] = [];
  let html = false;
  for (const raw of body.split(/\r?\n/)) {
    if (/^ {0,3}>/.test(raw)) continue;
    const f = raw.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (f) {
      if (!fence) fence = { char: f[1][0], length: f[1].length };
      else if (
        f[1][0] === fence.char &&
        f[1].length >= fence.length &&
        !f[2].trim()
      )
        fence = null;
      continue;
    }
    if (fence) continue;
    if (raw.includes("<!--")) html = true;
    if (html) {
      if (raw.includes("-->")) html = false;
      continue;
    }
    if (/^( {4}|\t)/.test(raw)) continue;
    for (const d of ["approve", "requestChanges", "hold"] as Decision[])
      if (raw.trim().toUpperCase() === markers[d].toUpperCase()) found.push(d);
  }
  // Conflicting markers in one comment are ambiguous, not success.
  return new Set(found).size === 1 ? found[0] : null;
}
export function roundBoundary(
  history: {
    createdAt: string;
    fromStateId?: string | null;
    toStateId?: string | null;
  }[],
  stateIds: string[],
): string | undefined {
  return history
    .filter(
      (h) =>
        h.toStateId &&
        stateIds.includes(h.toStateId) &&
        h.fromStateId !== h.toStateId &&
        Number.isFinite(Date.parse(h.createdAt)),
    )
    .map((h) => h.createdAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}
export function calculateReview(
  policy: ReviewPolicy | undefined,
  assigneeId: string | undefined,
  comments: ReviewComment[],
  boundary?: string,
  currentStateId?: string,
): ReviewResult {
  const result: ReviewResult = {
    status: "Not Configured",
    approvals: 0,
    required: policy?.requiredApprovals || 0,
    decisions: [],
    boundary,
  };
  if (!policy?.enabled) return result;
  if (
    !boundary ||
    !Number.isFinite(Date.parse(boundary)) ||
    !currentStateId ||
    !policy.inReviewStateIds.includes(currentStateId)
  ) {
    result.status = "Verification Required";
    result.warning =
      "无法确认当前 In Review 轮次；历史批准不能作为本轮通过依据。";
    return result;
  }
  const eligible = new Set(policy.eligibleReviewerIds);
  if (policy.excludeAssignee && assigneeId) eligible.delete(assigneeId);
  const latest = new Map<string, ReviewResult["decisions"][number]>();
  for (const c of [...comments].sort((a, b) => a.id.localeCompare(b.id))) {
    if (
      c.inline ||
      !c.user ||
      !eligible.has(c.user.id) ||
      !Number.isFinite(Date.parse(c.createdAt)) ||
      Date.parse(c.createdAt) < Date.parse(boundary)
    )
      continue;
    const d = parseMarker(c.body, policy.markers);
    const at = Date.parse(c.updatedAt || c.createdAt);
    if (!d || !Number.isFinite(at)) continue;
    const old = latest.get(c.user.id);
    if (!old || at >= Date.parse(old.at))
      latest.set(c.user.id, {
        reviewerId: c.user.id,
        name: c.user.name,
        decision: d,
        at: c.updatedAt || c.createdAt,
        excerpt: c.body.slice(0, 400),
        url: c.url,
      });
  }
  result.decisions = [...latest.values()];
  result.approvals = result.decisions.filter(
    (d) => d.decision === "approve",
  ).length;
  result.status = result.decisions.some((d) => d.decision === "requestChanges")
    ? "Changes Requested"
    : result.decisions.some((d) => d.decision === "hold")
      ? "On Hold"
      : result.approvals >= policy.requiredApprovals
        ? "Review Passed"
        : result.approvals
          ? "Partially Approved"
          : "Pending";
  return result;
}
