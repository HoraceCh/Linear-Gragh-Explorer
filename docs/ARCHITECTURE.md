# Architecture v0.2.0

The existing authentication, transport, pagination, normalization and graph analysis were extended rather than replacing the stack.

| Module | Responsibility |
|---|---|
| auth.ts | PKCE, state validation, in-memory credentials, serialized rotating renewal |
| api.ts | Query-only transport, timeouts/retries, paginated team discovery and team synchronization, bounded work pool |
| team/types.ts | TeamContext identity contract |
| team/session.ts | Abort and generation guards against stale asynchronous commits |
| model.ts | Unified graph model, scoped normalization, boundary placeholders, SCC and neighborhood analysis |
| profiles/model.ts | Allowlisted TeamProfile validation and browser-local storage |
| review/engine.ts | Deterministic marker parser, round boundary and eligible reviewer status calculation |
| review/api.ts | Validated issue comments/replies/history, pagination and in-memory result cache |
| analytics/index.ts | Active/completed/canceled counts, milestone summaries and dependency impact |
| graph/semantics.ts | View projection and layout fingerprint |
| graph/edges.ts | Current-data reconciliation and relationship rendering independent of layout |
| graph/layout.ts | ELK dependency input and topology settings |
| graph/GraphView.tsx | Worker layout, rendered routes, stable viewport, MiniMap and attribution |
| views/Hierarchy.tsx | Project/milestone and expandable issue hierarchy |
| components/ | Profile editor and review badges |
| main.tsx | Application state, team selector, overview, filters, details and queue orchestration |

## Team switching

Discovery lists metadata only. Selecting a team resolves its ID through a permission query before content reads. Project reads explicitly exclude descendants; issue reads use exact team ID and returned issues are checked again. Relation endpoints are requested as IDs only. No foreign endpoint is dereferenced.

Team switch aborts previous sync/review requests, clears graph/details/results, increments request epochs, loads that team's local configuration, and only commits a completed candidate whose guard remains current. Abort alone is insufficient: epoch tests also cover transports which ignore AbortSignal. Same-team failed refreshes retain the previous successful graph. Review page failures do not commit partial review batches.

## Comments and state history

Fields were checked against the live public Linear GraphQL schema before implementation. Comment exposes body, user ID/name, createdAt, updatedAt, url, parentId, documentContentId, quotedText and paginated children. Issue exposes paginated comments and history; IssueHistory exposes createdAt/fromStateId/toStateId. Inline descriptions are identified conservatively by non-null quotedText/document association, including ancestry. Deleted users have no eligible identity.

Only selected-team issues can start review reads. Every response is revalidated. In-review candidates are prioritized. Up to three issues are loaded concurrently; each connection is fully paginated. Replies follow already validated comment threads and verify issue/team identity. Summary results exist only in memory and are invalidated on refresh, profile change or team switch. Large review threads may still be expensive; no hidden full-workspace comment scan occurs.

## Layout and viewport

All relations remain in the normalized model. View projections choose which to draw. Membership edges are omitted from the canvas and represented by hierarchy/containers. Only true Blocks enter dependency mode. Related edges do not drive ELK layering. ELK uses layered layout, greedy cycle breaking, sweep crossing minimization and orthogonal routing; custom SVG edges render returned sections. Cycles remain visible and explicitly warned rather than asserted to be a DAG.

Grouped combined view uses milestone/project lanes with separate endpoint curves. Selection/details/status changes do not enter the structural layout fingerprint. Related visibility updates rendered edges without recomputing node layout. Asynchronous layout results are reconciled with current visible data before cards render. The canvas has no dynamic remount key. Structural changes and explicit layout trigger a readable fit; search focuses a matching node. Large graphs are explored through projects, filters and focus rather than extreme zoom-out.

## Security

No GraphQL mutations, shared tokens, secret-backed bypasses, external telemetry or HTML rendering of comments. React escapes task/comment text. The private hosting boundary is separate from Linear data authorization. Tokens remain in memory; OAuth transaction storage is short-lived. Local profiles are configuration only and are reconstructed through an allowlist on import. Public source contains synthetic fixtures only. No backend was introduced.

## v0.3 interaction and layout lifecycle

The compact filters and dashboard drill-down share the same criteria. Current review queue membership uses configured workflow state IDs. Dialogs keep keyboard focus and restore it on close. Worker lifetime is owned by the graph canvas. A superseded job can release its worker while completed jobs allow reuse. Viewport functions separate readable reset, overview and selection. Browser tests exercise the production bundle with synthetic task graphs.

## v0.3.x

v0.3.1 在同步前查询 viewer.id 与 viewer.organization.id，以两者和 Team ID 划分配置。应用和 ELK 继续运行在浏览器。详细边界见 [OAuth 安全](OAUTH-SECURITY.md)。

## v0.3.2

项目索引与工作区复用当前团队的一份规范化快照。选择项目、搜索、打开任务均在浏览器执行。图谱滚轮根据像素、行或页归一化后以指针为中心更新视口，中键拖动仅作用于画布。
