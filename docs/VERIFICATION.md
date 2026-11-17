# Verification

## Passed

- 18 automated tests covering dependency direction, completion semantics, cycles, scope exclusion, unknown references, deduplication, empty projects, pagination, rejected access, atomic failures and a 10,000-node analysis chain.
- OAuth tests cover PKCE S256, read-only scope, state validation, transaction expiry, scope rejection, in-memory credential lifecycle, concurrent renewal and refresh-token rotation.
- TypeScript and production build passed locally and in hosted CI run #3.
- Private browser acceptance confirmed authorization-code exchange, runtime-scoped synchronization, repeated data refresh and two successive real-provider token renewals followed by successful data synchronization.
- Private comparison checked aggregate totals, assignment totals, parent links and representative incoming/outgoing dependency directions against an independent source.
- Synthetic browser QA covered overview, search, task details, dependency layout, focus expansion and dark theme.

No private task contents, account identifiers, workspace identifiers, OAuth application metadata, token values or private screenshots are included in this report.

## Still pending

- A real account without permission to the selected team.
- Natural token expiry, revocation and cancellation during renewal.
- Exhaustive relation-set and milestone-membership comparison.
- Production fault injection for rate limits, offline refresh and partial failures.
- Full mobile touch QA and large-graph visual performance; the 10,000-node automated test covers analysis, not rendering.
- Deployment cache consistency: rapid deployment changes briefly showed an older HTML entry; a fresh versioned navigation loaded the current shell. Keep this open for migration acceptance.
- Static-host migration and callback-origin acceptance. The manual deployment workflow has not been run.

## Boundaries

The application requests only read access and performs no task mutations. Tokens stay in memory. Foreign endpoints are not expanded. Missing references are reported as unknown rather than assumed deleted. No critical-path claim is made without duration data.

The provider's read grant is broader than the application's selected-team query scope. Server-side provider permissions remain authoritative; application filtering is an additional boundary, not a replacement for authorization. Passing automated tests does not constitute full security acceptance.
