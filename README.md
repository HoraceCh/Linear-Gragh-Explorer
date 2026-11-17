# Linear Graph Explorer · PVCR

Private, read-only task graph explorer for **PV Cleaning Robotics (PVCR)**. React, TypeScript, Vite, React Flow, ELKjs. MIT licensed.

## Status

MVP implemented; real-user PKCE callback, token exchange, live synchronization and repeated refresh of task data have passed browser verification. Two successive real-provider token renewals and subsequent data syncs passed. A real denied-access account remains pending. The Sites deployment is owner-private. The optional demo is entirely synthetic. No real private tasks, tokens or client secrets are included in this repository. Source repository: https://github.com/HoraceCh/Linear-Gragh-Explorer. GitHub Pages is gated behind manual acceptance and is not enabled automatically.

## Run

```sh
npm ci
npm test
npm run dev
npm run build
```

Node 22+ recommended. Copy `.env.example` to `.env.local` if using a public OAuth Client ID at build time. Alternatively enter the public Client ID in the connection settings. **Never enter API keys, client secrets or access/refresh tokens there.**

## Connect Linear

Create an OAuth application in Linear settings. Register the exact callback displayed by the deployed site's connection settings. Use authorization code + PKCE (S256), actor=user, scope=read. No secret is used by this SPA. Do not request write or admin scopes.

The callback is the app's root URL, including its trailing slash and any Pages base path. Tokens remain in JavaScript memory; the tab can refresh its own access token, but reloading requires authorization again. This deliberately avoids persistent browser bearer credentials. Only the public Client ID and theme preference persist. The temporary PKCE verifier/state are stored in sessionStorage for at most the callback validation window (10 minutes); callback processing removes them.

## Features

- Team overview and project discovery, including empty projects
- Project / milestone membership and parent-child issue edges
- Dependency, combined and focus views; iterative upstream/downstream expansion
- Search, assignee/status/project filters, archived toggle, collapse, ELK worker layout, zoom and minimap
- Details and safe outbound Linear links; light/dark layouts
- Blocks-only cycle detection, unresolved references, isolated issues and unfinished prerequisites
- Full pagination, bounded rate-limit retries, cancellation, timeout, atomic snapshot replacement

No durations are available, so this app makes **no critical path claim**.

## Boundaries

Team Key is fixed to PVCR in `src/model.ts`. A filtered, per-user query resolves exactly one matching team at runtime; its UUID is not published in source. Projects are queried through that resolved team, `includeSubTeams:false`. Issues use exact Team UUID filtering and each returned item is revalidated. Relations only query IDs of their endpoints; foreign endpoints are never expanded for metadata. A shared project belongs to PVCR if returned by `team.projects`; only PVCR issues within it are retrieved. Changing the JS client cannot grant rights that the user's Linear identity does not possess. OAuth read scope itself is not a team-scoped grant; the application enforces the narrower request scope.

A missing reference is **not proof of deletion**. Deleted/trashed, moved, inaccessible and cross-team references may be indistinguishable to this API caller. The UI labels them unknown and counts nodes that disappeared between complete snapshots without probing other teams. Archived issues remain available through an explicit filter. Failed/partial refreshes keep the previous successful snapshot and its original sync timestamp.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment and handoff](docs/DEPLOYMENT.md)
- [Verification and security status](docs/VERIFICATION.md)
- [Development stages](docs/ROADMAP.md)
