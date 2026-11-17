# Architecture

UI (`main.tsx`) → Graph model (`model.ts`) ← Synchronizer (`api.ts`) → Transport → Linear GraphQL

OAuth (`auth.ts`) owns authorization-code + PKCE S256, state validation, token response scope validation, in-memory credentials and single-flight rotating refresh. `syncGraph` accepts a Transport interface, so UI and normalization do not depend on the deployment target. ELK layout executes in a Web Worker to avoid freezing input during layout.

## Security model

Sites access control is the first boundary (owner-private). Linear OAuth is a separate per-user data boundary. GraphQL queries are read-only and use the user's bearer token. No credential is copied from the ChatGPT connector. No GraphQL mutations, telemetry, remote images, markdown HTML rendering, shared API keys, task exports or data storage exist. CSP restricts connection origin to Linear, disables object embedding and restricts scripts to self. React escapes task text. OAuth callbacks remove query strings immediately and use a no-referrer policy.

Browser storage contains only public Client ID, theme, and short-lived OAuth transaction state/verifier. Browser reload requires login again. Disconnect clears local credentials/data; it does not claim remote revocation. API 401/403 is surfaced for reauthorization. Refresh tokens rotate with a single in-tab refresh promise; separate tabs authorize separately.

## Relationship semantics

- Membership: project → milestone → issue, or project → issue without milestone.
- Parent: parent issue → child issue, independent of milestone assignment.
- Blocks: source prerequisite → blocked target. Incoming `inverseRelations` retains the API source/target; it is not reversed a second time.
- Related: symmetric dashed link; no blocking or cycle meaning.
- Unknown types are not guessed to be Blocks.

Only Blocks are used for dependency SCCs and unfinished prerequisite flags. Parent/Blocks edges drive focus expansion. Isolated means no task-to-task edges; project membership does not disqualify isolation.

## Refresh and migration

Fetch all pages for projects, issues, milestones and both relation connections, including archived records. Abort or reject the entire candidate snapshot if any query fails, rather than displaying a successful-but-incomplete sync. Keep previous successful data visibly timestamped. No query follows a foreign endpoint. No cached conversation data feeds the application.

Sites and Pages build the same SPA with Vite `base`. Root callback avoids static-host route rewrites. Production auth still requires end-to-end validation. Preflight success alone cannot prove token exchange/refresh works.

## Server adapter contingency

If actual OAuth exchange/refresh fails browser compatibility or policy validation, stop direct-mode rollout. Implement the same Transport behind a same-origin BFF: encrypted per-user token records, opaque Secure/HttpOnly/SameSite cookies, CSRF checks, PKCE/state binding, atomic refresh rotation and server-side PVCR-scoped query allowlist. Use a separate OAuth registration and registered callback for that deployment. A same-origin proxy or custom domain is required if Pages and the BFF would otherwise depend on third-party cookies. Never proxy arbitrary GraphQL or use a shared account token. This contingency is documented, **not deployed**: current preflight results support testing the simpler public-client PKCE path first.
