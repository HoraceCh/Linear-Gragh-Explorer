# Deployment

Use the existing private preview and existing MIT repository. No additional Site/repository or public deployment is required.

## Local

1. Node 22+, `npm ci`.
2. Put a public `VITE_LINEAR_CLIENT_ID` in ignored `.env.local`, or enter it in connection settings.
3. Register the exact application-root callback shown by the app. PKCE S256, actor=user, scope=read; no client secret.
4. `npm run dev`, `npm test`, `npm run build`.

The core is team-independent. A deployment's OAuth application may be limited by its registration to one workspace; source portability does not override that restriction. Other workspaces need their own authorized OAuth app. Multi-workspace sessions are out of scope.

## Private Sites

The private checkout retains its internal `.openai/hosting.json`; do not publish that manifest. Copy the sanitized application source from the feature branch, retain private hosting identity, set ignored environment configuration, build and deploy through the existing private source/version workflow. Keep owner-only access unchanged. The v0.2 preview was deployed to this existing owner-private Site; sharing and Pages were not enabled. Never copy tokens or task snapshots into source or archives.

## GitHub

Use a feature branch and Pull Request. CI installs the lockfile, tests, typechecks and builds. Do not force-push or replace main history. Private-host development commits and sanitized public commits may have different SHAs; record both in the delivery report.

## Validate a Pages build locally

Use a clean checkout and a public client ID if a default is desired. The release only needs the application code. A visitor supplies their own Linear identity. Browser-local profiles are origin-specific, so a profile configured on the private preview requires explicit import or configuration on another origin.

```bash
npm ci
npm test
node --test scripts/validate-pages.checks.mjs
VITE_BASE_PATH=/Linear-Gragh-Explorer/ npm run build
node scripts/validate-pages.mjs dist /Linear-Gragh-Explorer/
```

CI runs the subpath build and validates the exact script, stylesheet and ELK worker references. Only the HTML shell, optional host header file and content-hashed JavaScript/CSS assets may enter the upload. The validator rejects extra files, symlinks, sourcemaps and common credential or private-site identifier signatures. A human review of source and public assets still matters, since generic text and arbitrary private data can resemble legitimate application strings.

### OAuth and routing

For a future project-site release the expected callback is `https://horacech.github.io/Linear-Gragh-Explorer/`. Verify the exact URL displayed in connection settings and register it with the OAuth application before the first live test. The callback reads the code and state from the query at the app root and removes the query string after processing. Views are React state under that path. A rewrite or custom 404 fallback is unnecessary for the current navigation. Never supply a secret in a Vite environment variable. OAuth read permits reads available to the user across the workspace. Each application request also checks the selected Team's identity and scope.

### Release workflow

A future release owner runs **Publish Pages after acceptance** manually on the default branch after approving public deployment. The dispatch input defaults to false. The build job has read-only repository access and runs the same tests and artifact checks as CI. Only its dependent deployment job receives Pages and ID-token write permission. The workflow targets the `github-pages` environment, whose branch and reviewer protections are configured in repository settings. CI builds on a PR have no publish step. This release preparation does not enable Pages or configure a publishing source.

### Cache and rollback verification

The HTML uses hashed asset names. The private host can apply `public/_headers`; check response headers on the actual origin before relying on those directives. GitHub Pages has its own cache policy, and the artifact validator measures paths and contents only. On a future authorized release, open an existing tab and a fresh profile, reload the project root and verify that the HTML, main JS, CSS and ELK worker agree. Complete one OAuth callback returning to the canonical root. Keep a record of the deployed public SHA and observed responses. A stale browser may require a hard reload followed by reconnection because credentials exist only in memory. Roll back through a reviewed revert and the same release workflow.

[GitHub documentation for custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

Returning to a production tab triggers a rate-limited, uncached same-origin check of its HTML module entry. A changed bundle prompts the user before reloading; a failed check leaves the current session usable. The application version comes from package metadata. Public Pages host headers and the registered callback still require a real release smoke test.

## v0.3.x

主要托管目标使用 [Vercel 部署流程](VERCEL-DEPLOYMENT.md)。Pages 保留手动备用构建。跨 Workspace 也可由已获相应工作区授权的 Public OAuth App 接入。
