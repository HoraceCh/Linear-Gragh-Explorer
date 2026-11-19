# Linear Graph Explorer · v0.3.3

Read-only task graphs and review intelligence for any team accessible to your Linear identity in the connected workspace. React, TypeScript, Vite, React Flow and ELKjs. MIT licensed.

## Run

```sh
npm ci
npm test
npm run dev
npm run build
```

Node 26 (与 `.nvmrc` 保持一致)。 Copy `.env.example` to `.env.local` and configure only your public OAuth Client ID, or enter it in connection settings. Register the exact callback displayed in the application. Authorization uses `actor=user`, `scope=read`, PKCE S256. No client secret or shared token is used. The source has no default application credentials or private team IDs.

## What changed

- Paginated team discovery, explicit TeamContext, persisted selection and cancellable, atomic team synchronization.
- Team-local profiles: arbitrary roles, member mappings, label-based workstreams, import/export, validation and reset.
- Strict review markers in Linear comments; latest eligible reviewer decision in a confirmed current In Review round. No approval UI or Linear writes.
- Overview, project/milestone progress, workload indicators, recent updates, status and review filters.
- Semantic graph views: hierarchy tree, Blocks-only dependency graph, progressive focus and independently toggled combined view.
- ELK orthogonal dependency routes, stable canvas lifecycle, readable initial zoom and configurable high-contrast minimap.
- Explicit synthetic 20/50/100-node stress fixtures for repeatable graph QA.

Validation: 88 automated tests, TypeScript and production build; authenticated synchronization with two structurally different Teams in one workspace. See verification notes for remaining acceptance limits.

The product remains useful without configuring roles or review rules. Each user configures their own browser; profiles are not automatically shared.

## Data boundaries

Authentication stays in memory. Browser storage contains only display preferences, selected Team ID, public Client ID, local profile configuration and temporary OAuth transaction state. Profiles can contain member and label IDs; exported profiles are private configuration and must not be committed publicly. Issues/comments are not persisted in localStorage, telemetry or source.

All content operations receive the selected TeamContext. Returned issues, comments and replies are revalidated. Foreign relation endpoints become anonymous boundary placeholders; the app never follows them. Failed or incomplete data refreshes retain the previous complete snapshot. Switching teams clears it immediately and prevents stale writes.

OAuth `read` is workspace-scoped at the provider; selected-team filtering is an additional application boundary. Each deployment needs an OAuth app allowed in its target workspace. Multi-workspace operation is outside this release.

## Graphs

Hierarchy uses project/milestone grouping and expandable task trees. Dependency shows only Blocks, with orange arrows from prerequisite to blocked task. Focus expands Blocks and parent/child neighbors one layer at a time. Combined starts with Blocks only; parent, related and grouping are opt-in. Related links are undirected and never participate in dependency analysis. No critical path is claimed without durations.

ELK routes are rendered for ungrouped dependency topology. Grouped combined view deliberately uses a separate lane arrangement and curved React Flow endpoint routing; it does not claim to use ELK route geometry.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Review policy and semantics](docs/REVIEW-POLICY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Verification](docs/VERIFICATION.md)
- [Roadmap](docs/ROADMAP.md)

The existing ChatGPT Site remains owner-private for development. Vercel is the intended primary production host; GitHub Pages is the public fallback. Neither is considered live production until its own OAuth, access-control and deployment checks pass.

## v0.3 product-quality preview

The overview links into filtered work, the configured queue shows current review candidates, and graph controls distinguish a readable starting position from a whole-graph fit. Open **更多筛选** for secondary filters. Use **视图与审阅设置** to edit this browser’s team-specific policy.

See [UX audit](docs/UX-AUDIT.md), [performance measurements](docs/PERFORMANCE.md), and [release readiness](docs/RELEASE-READINESS.md). Run the synthetic browser suite after building with `npx playwright install chromium` and `npm run test:browser`.

## v0.3.x

v0.3.1 候选版支持 Vercel 根目录与 Pages 子路径构建。逐用户配置与发布门禁见 [Vercel 部署](docs/VERCEL-DEPLOYMENT.md) 和 [OAuth 安全](docs/OAUTH-SECURITY.md)。

候选版依赖审计及待修项见 [依赖安全记录](docs/DEPENDENCY-SECURITY.md)。

## v0.3.3

项目探索升级为项目工作区，展示项目指标、状态分布、里程碑进展和全宽任务列表。审阅队列独立发现 In Review 任务，不受其他视图筛选影响；新增 Unable to assess 决策。视图与审阅设置明确区分个人本地配置与 Linear 团队权限。

三端发布规划和验收见 [双目标部署](docs/DUAL-DEPLOYMENT.md)、[部署说明](docs/DEPLOYMENT.md) 和 [发布门禁](docs/RELEASE-READINESS.md)。


### 团队成员使用

发布目标为 Vercel 主入口 `https://linegraph.vercel.app/` 和 Pages 入口 `https://horacech.github.io/Linear-Gragh-Explorer/`。以正式 Release 记录判断是否已上线。每人使用自己的 Linear 身份授权，选择团队后等待首次完整同步。项目工作区可按里程碑和负责人查看任务。审阅队列解释当前轮次和有效意见。同步失败时请查看上次成功时间并重试。

视图与审阅设置保存在当前浏览器，按工作区、用户、团队隔离。规则维护人可在团队私有空间保存一份版本化的配置 JSON，成员在对应团队导入并确认成员和状态。两个站点的配置需分别导入。团队成员或状态被移除时，先修复配置再核验审阅结果。
