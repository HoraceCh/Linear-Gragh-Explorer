# Read-only Review Intelligence

Reviews happen in Linear. This app only reads and interprets explicit markers; there are no approval buttons, status mutations or independent approval database.

```text
[REVIEW: APPROVE]

Explanation of the review.
```

Other defaults: `[REVIEW: REQUEST_CHANGES]` and `[REVIEW: HOLD]`.

A marker must be a standalone line and is recognized case-insensitively. Quoted lines, fenced code, indented code, HTML comments, inline-description threads and ordinary natural-language approvals are ignored. Conflicting marker types in one comment are ambiguous and do not count. Marker spellings can be configured, but must remain distinct bracketed REVIEW markers.

## Configure

Select a team, open Team Configuration, enable review analysis, select actual team member IDs, set the required approval count, choose actual In Review state IDs, and normally exclude the assignee. An empty eligibility list authorizes nobody. Review rules are optional. Roles and display names do not grant reviewer authority.

Profiles are local to this browser and keyed by team ID. JSON export contains private member/label configuration IDs, never task snapshots or tokens. Do not publish exported profiles. Import validates the team binding and discards unknown fields. Reset removes the configured policy after saving defaults.

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
