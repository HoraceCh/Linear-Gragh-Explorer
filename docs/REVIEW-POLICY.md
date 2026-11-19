# Read-only Review Intelligence

Reviews happen in Linear. This app only reads and interprets explicit markers; there are no approval buttons, status mutations or independent approval database.

```text
[REVIEW: APPROVE]

Explanation of the review.
```

Other defaults: `[REVIEW: REQUEST_CHANGES]` and `[REVIEW: HOLD]`.

A marker must be a standalone line and is recognized case-insensitively. Quoted lines, fenced code, indented code, HTML comments, inline-description threads and ordinary prose are ignored. Conflicting marker types in one comment are ambiguous and do not count. Marker spellings can be configured, but must remain distinct bracketed REVIEW markers.

## Configure

Select a team, open Team Configuration, enable review analysis, select actual team member IDs, set the required approval count, choose actual In Review state IDs, and normally exclude the assignee. An empty eligibility list authorizes nobody. Review rules are optional. Roles and display names do not grant reviewer authority.

Profiles are local to this browser and keyed by workspace, viewer and team IDs. JSON export contains private member/label configuration IDs, never task snapshots or tokens. Do not publish exported profiles. Import validates the team binding and discards unknown fields. Reset removes the configured policy after saving defaults.

## Current round

Fetch all state-history pages. The latest actual transition into any configured In Review state is the round boundary. Only comments created in that round count; editing a comment from a previous round does not move it into the current round. Within the round the latest valid decision per eligible user wins, ordered by updated timestamp; duplicates count once. Edited comments are re-read. A successful refresh replaces the result and removes deleted comments.

The issue must currently be in a configured In Review state. If history cannot be read, the boundary is absent/invalid, or the issue is outside the configured states, display Verification Required rather than a potentially stale success. No boundary timestamp is invented. Decisions are recalculated after explicit refresh; this is not a live webhook subscription.

| Condition | Status |
|---|---|
| No enabled policy | Not Configured |
| Boundary or current round uncertain | Verification Required |
| No valid decisions | Pending |
| Some but insufficient approvals | Partially Approved |
| Required count reached and no outstanding objections | Review Passed |
| Any latest eligible request for changes | Changes Requested |
| Any latest eligible hold, with no request for changes | On Hold |

A later APPROVE replaces that same user's earlier objection. Another user's outstanding objection still blocks passed status. Review Passed is analysis, not Linear Done. Invalid/no-marker comments are not decisions and do not implicitly revoke another valid comment; edit/delete the marked decision or post a new formal marker to change it.

## Loading and limits

In Review tasks load first. Other task reviews load on demand from details or explicit filtered-queue refresh. Requests use bounded concurrency, pagination, cancellation, retry handling and memory-only result caching. A partial comment read cannot yield success. Failed review batches retain prior completed results and display an error. A real review round with genuine marker decisions is still needed for production-level approval acceptance; synthetic tests never substitute for it.

Candidate checks scope each comment, reply and history request by both issue and team on Linear. The history read supplies the current state and assignee for the calculation. An issue moving teams aborts the read. Replies with missing ancestry and decisions created at the exact transition timestamp are excluded. A thread with no children needs no separate reply query.

Real two-reviewer approval acceptance pending external evidence. A qualifying sample requires two distinct eligible reviewer IDs posting valid decisions after the same verified transition.

## v0.3.2 独立行命令

| 决定 | 默认命令 |
| --- | --- |
| 批准 | Approved、Approved with comments、[REVIEW: APPROVE] |
| 要求修改 | Request changes、Changes requested、[REVIEW: REQUEST_CHANGES] |
| 暂缓 | Hold、On hold、[REVIEW: HOLD] |

大小写不限，说明可另起一行。代码、引用、行内讨论、存在相互冲突决定的整条评论均不计入。审阅详情按原因统计忽略项，显示本轮每位有效审阅人的最新决定。手动刷新重新读取评论和历史。入审前创建的评论在本轮编辑仍然不计入。Real two-reviewer approval acceptance pending external evidence


## v0.3.3 · Unable to assess and candidate discovery

| Decision | Default command | Effect |
|---|---|---|
| Approve | Approved / Approved with comments | Counts as one distinct reviewer approval |
| Request changes | Request changes / Changes requested | Blocks Review Passed |
| Hold | Hold / On hold | Blocks Review Passed |
| Unable to assess | Unable to assess | Explicitly blocks Review Passed; not an approval and not a Hold |

The latest valid decision per reviewer wins. A later decision can replace that reviewer's earlier Unable to assess; another reviewer's outstanding objection still blocks passing.

The review queue discovers current In Review candidates from the synced Linear state name and configured state IDs independently of the personal review policy and global graph filters. When policy is disabled, users can still see the candidate tasks, but the app does not calculate or claim approval. Review search and project/status/reviewer filters are local to the review queue.

Settings are browser-local and scoped to workspace, viewer and team. They do not change Linear permissions or automatically synchronize between members. Exported profiles include member and label IDs and must be shared only through a private team channel.
