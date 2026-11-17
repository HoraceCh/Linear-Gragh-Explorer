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
- [ ] Real integration acceptance on two structurally different teams.
- [ ] Real marked-review round acceptance without writing test comments.
- [ ] Full mobile touch, 100-node visual performance and deployment-cache acceptance.
- [ ] Private preview deployment and sanitized feature-branch CI confirmation.

Release decisions remain explicit: no Linear writes, no shared credentials, no new backend, no Pages publication. A future shared profile service and multi-workspace sessions are separate releases.
