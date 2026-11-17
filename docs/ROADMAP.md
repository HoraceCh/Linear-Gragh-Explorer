# Tracked development phases

- [x] A. Scope discovery, private Sites registration, CORS preflights, API schema inspection.
- [x] B. React/TypeScript SPA, graph normalization, read-only GraphQL transport and PKCE implementation.
- [x] C. Views, filters, details, worker layout, synthetic edge cases and initial build.
- [x] D1. Create private OAuth application; verify real read-only PKCE callback, token exchange and live data sync.
- [ ] D2. Verify real token rotation/expiry and a no-PVCR-permission account.
- [x] E1. Compare counts and assignments privately; verify parent links and representative incoming/outgoing Blocks.
- [ ] E2. Complete exhaustive relation/milestone comparison.
- [x] F1. Create Public GitHub source repository.
- [x] F2. Upload complete sanitized source and confirm hosted CI (install, tests and build passed).
- [ ] G. Pass full security acceptance, then run manual GitHub Pages deployment.

Source commits separate initial implementation from verified fixes/documentation. No Linear write operations are included in any stage.
