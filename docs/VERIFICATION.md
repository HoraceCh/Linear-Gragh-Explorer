# v0.2.0 verification

## Implemented and verified automatically

82 tests passed locally, retaining all 18 original scenarios and adding:

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

Pending: real two-team switching, comment/history loading with configured genuine markers, before/after real-data screenshots, and feature-branch CI. Synthetic UI results must not be described as real integration.

## Limitations requiring explicit follow-up

No actual denied-access account is available. Real expiry/revocation, production fault injection, full mobile touch and 100-node visual behavior remain separate acceptance items. Local profiles are not shared. Schema availability alone does not prove every workspace grants history access; missing history yields Verification Required. No fake review markers are written to Linear for testing. The app has no semantic/AI approval inference.

All private screenshot evidence stays outside the public repository. Public fixtures are synthetic. The existing private preview is the only deployment target in this release.
