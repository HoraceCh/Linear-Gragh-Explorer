# Linear Graph Explorer · v0.2.0

Read-only task graphs and review intelligence for any team accessible to your Linear identity in the connected workspace. React, TypeScript, Vite, React Flow and ELKjs. MIT licensed.

## Run

```sh
npm ci
npm test
npm run dev
npm run build
```

Node 22+. Copy `.env.example` to `.env.local` and configure only your public OAuth Client ID, or enter it in connection settings. Register the exact callback displayed in the application. Authorization uses `actor=user`, `scope=read`, PKCE S256. No client secret or shared token is used. The source has no default application credentials or private team IDs.

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

The existing preview remains private. GitHub Pages is not enabled or published in this stage.

## v0.3 product-quality preview

The overview links into filtered work, the configured queue shows current review candidates, and graph controls distinguish a readable starting position from a whole-graph fit. Open **更多筛选** for secondary filters. Use **团队配置** to edit this browser’s team-specific policy.

See [UX audit](docs/UX-AUDIT.md), [performance measurements](docs/PERFORMANCE.md), and [release readiness](docs/RELEASE-READINESS.md). Run the synthetic browser suite after building with `npx playwright install chromium` and `npm run test:browser`.
