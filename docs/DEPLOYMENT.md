# Deployment and handoff

## Phase 1: Sites

Registered site: `https://pvcr-team-graph-explorer.lyricaldot3.chatgpt.site/`

Keep owner-only access. Private Sites checkout has an internal hosting manifest declaring static `dist`. That internal manifest is excluded from the public GitHub repository; GitHub Pages uses its workflow instead. OAuth callback to register:

```text
https://pvcr-team-graph-explorer.lyricaldot3.chatgpt.site/
```

The site works as an interactive synthetic demo before OAuth setup. The owner must sign into Linear to create an OAuth application; the available connector does not create OAuth apps. Configure a public application with PKCE, actor=user and read scope. Enter only its public Client ID in the site, authorize, and run the live acceptance checklist. Never send a Client Secret or token in chat.

## Phase 2: GitHub source

Requested target normalized from the whitespace-containing name: `HoraceCh/Linear-Gragh-Explorer`. The Public repository has been created at https://github.com/HoraceCh/Linear-Gragh-Explorer. Browser sign-in was used for creation; source updates use the GitHub connector.

Create an empty **Public** repository without initialization, then push the existing main history to it. The source includes MIT license, CI, architecture, deployment instructions and synthetic tests. Exclude node_modules, dist, local env, credentials, archives, private task snapshots and inspection output. Do not replace or force-push an existing repository.

## Phase 3: Pages (after acceptance)

1. Register additional OAuth callback `https://horacech.github.io/Linear-Gragh-Explorer/` (only after confirming actual repository name).
2. Set repository variable `LINEAR_CLIENT_ID` to the public ID. No token/secret required.
3. Enable GitHub Pages with GitHub Actions source.
4. Run `Publish Pages after acceptance`, checking the acceptance input only when live tests pass.
5. Workflow builds with `VITE_BASE_PATH=/<repository-name>/`, tests, uploads dist and deploys.
6. Verify initial load, OAuth return, token refresh, no-PVCR account denial, and absence of private data in all static assets/artifacts.

Pages serves the public application shell. Linear data remains per-user, fetched after authorization. This is not equivalent to Sites' owner-only shell access. The user requested Pages migration, but it is deliberately not executed before acceptance. If the whole shell must remain private, retain private Sites or add an authenticated edge host instead of ordinary Pages.

The SPA uses no history-based nested routes, so no 404 fallback is needed. A backend is not required if PKCE browser exchange and refresh pass; if they fail, use the BFF contingency described in ARCHITECTURE and re-run the security review.
