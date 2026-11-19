# v0.2.0 delivery stages

- [x] Audit MVP, live schema inspection, safe source baseline.
- [x] Dynamic paginated team discovery, explicit TeamContext, selected-team permission verification.
- [x] Atomic team sync, cancellation/generation guards, local selected-team restoration.
- [x] Team-local role/workstream/profile settings and validated JSON import/export/reset.
- [x] Comment/reply/history reading and strict marker/current-round calculation.
- [x] Read-only review queue, detail evidence and node status.
- [x] Overview/progress/status/milestone/recent updates/dependency impact/workload indicators.
- [x] Semantic hierarchy/dependency/focus/combined views, ELK route sections and minimap controls.
- [x] Expanded automated tests and production build.
- [x] Real synchronization/switching acceptance on two structurally different teams in one workspace.
- [ ] Real marked-review round acceptance without writing test comments.
- [x] Synthetic 20/50/100-node browser layout, search and progressive focus acceptance.
- [ ] Full mobile touch, quantitative performance and deployment-cache consistency across clients.
- [x] Existing owner-private preview deployment and sanitized feature-branch PR/CI.

Release decisions remain explicit: no Linear writes, no shared credentials, no new backend, no Pages publication. A future shared profile service and multi-workspace sessions are separate releases.

## v0.3

Implemented actionable overview counts, compact filters, current-state queue, grouped evidence, accessible modal navigation, cancelable layout and viewport controls. Added 200/800 performance fixtures, Chromium acceptance and manual Pages artifact validation. Outstanding: real marked round, real denied identity, physical device accessibility and public-origin callback, conditioned on explicit release approval.

## v0.3.x

v0.3.1 的源码门禁与账号分区进入候选阶段。后续按顺序取得保护预览、稳定回调、受限第二账号和正式域名验收记录。
