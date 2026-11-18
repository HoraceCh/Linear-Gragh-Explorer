# v0.2.0 verification

## Implemented and verified automatically

88 tests passed locally, retaining all 18 original scenarios and adding:

- Empty/one/multiple paginated teams, arbitrary state metadata, strict team permission/issue checks, partial failure, abort and stale-generation guards.
- Independent profiles, role validation, import team binding and unknown-field/token/snapshot rejection.
- Standalone case-insensitive markers, quote/code/HTML exclusions, distinct eligible reviewers, deduplication, objections/holds, later supersession, excluded assignees, edited/deleted comments, old rounds and uncertain history.
- Comment pagination, inline exclusion, permission boundaries, cache invalidation, aborted requests and failed reads.
- Transport rate limiting, network failures, partial GraphQL errors and mutation rejection.
- Semantic view projections and 20/50/100-node graphs with dense related links. ELK layout tests verify forward DAG placement and returned orthogonal route sections.
- Existing 10,000-node graph analysis test; this is not a visual rendering benchmark.

TypeScript and production Vite build passed locally.

## Schema verified

Live public schema inspection confirmed Comment body/user/createdAt/updatedAt/url/parentId/children/documentContentId/quotedText and Issue.history with fromStateId/toStateId/createdAt. Replies point to their root. Standard comments have null quotedText; description/document inline comments reference selected text. No private contents or identifiers are recorded here.

## Browser and production acceptance

Verified in the authenticated private preview:

- Discovery of several accessible Teams and complete synchronization of two structurally different Teams in the same workspace, including PVCR. Switching back immediately removed the former Team's content during loading, then restored the selected Team's complete snapshot.
- A genuine In Review Issue loaded its comments and actual state-history boundary. With two selected reviewers and assignee exclusion configured locally, it correctly displayed Pending with zero valid approvals. Ordinary historical review text was not promoted to approval.
- Opening details preserved the exact React Flow viewport transform. The old and new real-data dependency screenshots were captured privately. Dependency mode excludes Related To without removing it from the normalized model.
- Browser benchmarks covered synthetic 20/100, 50/200 and 100/500 node/task-relationship samples. The 100-node graph contains 300 genuine dependency edges; focus narrowed it to 7 nodes at one hop and 13 at two hops. Search, details, grouping, dark mode, MiniMap drag-panning and hiding were exercised.
- A review/selection transition crash found during browser QA was fixed and now has a regression test. Related visibility updates independently of layout and viewport; outgoing cards cannot render with missing current data.
- Feature-branch CI passed for the first implementation commit. Final follow-up commit CI is recorded in the PR.

Synthetic checks are not evidence of genuine reviewer approvals. There were no existing qualifying two-reviewer marker decisions available for a real Review Passed acceptance, and no comments were posted for testing. Private data, screenshots and profile configuration are excluded from this public record.

## Limitations requiring explicit follow-up

No actual denied-access account is available. Real expiry/revocation, production fault injection, full mobile touch, production rate-limit/fault injection and quantitative large-team performance profiling remain separate acceptance items. Local profiles are not shared. Schema availability alone does not prove every workspace grants history access; missing history yields Verification Required. No fake review markers are written to Linear for testing. The app has no semantic/AI approval inference.

All private screenshot evidence stays outside the public repository. Public fixtures are synthetic. The existing private preview is the only deployment target in this release.

## Release candidate recheck

The baseline lockfile installed cleanly on Node 24. All 88 original checks and the production build passed. The private version and PR contained identical public tracked files. Read-only checks on two differently configured teams confirmed switching cleared prior content. The current real review round had zero qualifying decisions from two configured reviewers. Real two-reviewer approval acceptance pending external evidence.

Stabilization adds coverage for current assignee/state during review, ambiguous timestamps, removed or moved items, profile validation, anonymous references, transport denial and refresh recovery. Provider denial invalidates in-memory team data. Transient network failure preserves the previous complete snapshot. Actual revoked and access-denied identities remain outstanding.

## Product-quality candidate

RC verification passed 101 Vitest checks. The v0.3 candidate adds fixture, viewport and worker lifecycle checks, eight Pages artifact checks and production Chromium tests for responsive navigation, dialog focus, filters, details and dense graph selection. CI runs Chromium independently of private identity. See the current PR checks for browser outcomes.
