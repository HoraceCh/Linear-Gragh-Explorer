# Verification — 2026-11-17

## Verified locally

- 17 automated tests: Blocks direction/completion, relation semantics, SCC cycles, cross-team exclusion, missing references, deduplication, empty projects, 10,000-node chain, pagination/repeated cursor, denied access, atomic failure, PKCE read scope/S256/user actor, state mismatch, expiry, rejection of broad scopes, in-memory token lifecycle.
- TypeScript check and production Vite build.
- Browser QA: first visit, synthetic overview, dependency view, text search, details, focus expansion, dark theme. Found/fixed detail dismissal clearing focus. Full mobile hardware/touch QA and 10,000-node visual layout remain unverified; large-chain test covers model analysis, not visual performance.
- Live Linear API schema introspection checked Project/Team/Issue relation arguments. Corrected project query to `team(id).projects(includeSubTeams:false)` rather than unsupported `ProjectFilter.teams`.
- Live OPTIONS preflight for GraphQL and OAuth token endpoint returned HTTP 204 with matching Sites origin and requested headers allowed. This was a network preflight, **not** an authenticated browser flow.
- Unauthenticated read requests are denied with AUTHENTICATION_ERROR. No mutation was sent.
- Desktop synthetic data was used for screenshots/QA; no real tasks embedded into source or build.

## Pending production acceptance — do not mark complete

1. **Passed:** workspace-private OAuth registration, owner Site login, real-user read-only PKCE callback and token exchange, live task synchronization and a second successful data refresh.
2. Validate rotating refresh with real provider response and expiry; revoked/expired token behavior; cancellation during sync.
3. **Partially passed:** project/issue/milestone totals and assignment totals match an independent private connector baseline. Verified incoming and outgoing Blocks for a representative task and all three parent-child links. Private task values and snapshots are deliberately excluded from this source repository. Exhaustive relation-set and milestone-membership comparison remains pending.
4. Login as a user without PVCR access and verify no tasks are rendered or cached. OAuth read scope may cover the user's broader account, but the application's requests must remain Team constrained.
5. Validate 429 recovery, offline refresh and partial-error UX in production (unit coverage is not a provider fault injection).
6. **Passed:** sanitized source uploaded to Public GitHub repository. Hosted CI run #1 passed npm ci, all 17 tests and production build. Source excludes the private hosting manifest, fixed private Team UUID, task snapshots and credentials.
7. Only after all above: Pages publish and repeat origin/callback/access tests.

## Security findings and limitations

No shared high-privilege credentials, persistent bearer token storage, Linear writes or conversation-cache runtime data are used. Foreign endpoint metadata is never dereferenced. Missing/invisible records cannot reliably be distinguished as deleted vs inaccessible, so the UI reports uncertainty rather than fabricating a deletion status.

Direct PKCE exchange and live GraphQL passed in the authenticated browser. Rotating token renewal and negative-account acceptance remain provisional. If token/CORS compatibility fails, the server adapter contingency must be implemented and reviewed before migration. Sites is owner-private; a future Pages shell would be public, while API data still requires the user's own Linear authorization.

Linear settings and GitHub browser sign-in are now available. No claim of full security acceptance is made. No additional account with denied PVCR access is available for the negative-account test.

## OAuth registration update

Created workspace-private OAuth application **PVCR Graph Explorer** in Baukasten Park. Public Client ID is configured as the SPA default. Public availability, client-credentials grants and webhooks are disabled. No secret or developer token was read or used. Production Site sign-in, real-user OAuth exchange and two full task-data syncs passed. Token rotation and expiry are not yet verified with the real provider.

## Runtime scope recheck

The public core now resolves a unique PVCR Team by a filtered key query in the authorized workspace. Every subsequent issue is checked against the returned UUID. Private production browser reauthorization and full synchronization passed after this change. The OAuth app remains private to its owning workspace. Internal hosting metadata stays in the private Sites checkout and is not part of the public source tree.
