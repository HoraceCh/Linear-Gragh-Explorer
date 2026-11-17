# Deployment v0.2.0

Use the existing private preview and existing MIT repository. No additional Site/repository or public deployment is required.

## Local

1. Node 22+, `npm ci`.
2. Put a public `VITE_LINEAR_CLIENT_ID` in ignored `.env.local`, or enter it in connection settings.
3. Register the exact application-root callback shown by the app. PKCE S256, actor=user, scope=read; no client secret.
4. `npm run dev`, `npm test`, `npm run build`.

The core is team-independent. A deployment's OAuth application may be limited by its registration to one workspace; source portability does not override that restriction. Other workspaces need their own authorized OAuth app. Multi-workspace sessions are out of scope.

## Private Sites

The private checkout retains its internal `.openai/hosting.json`; do not publish that manifest. Copy the sanitized application source from the feature branch, retain private hosting identity, set ignored environment configuration, build and deploy through the existing private source/version workflow. Keep owner-only access unchanged. Never copy tokens or task snapshots into source or archives.

## GitHub

Use a feature branch and Pull Request. CI installs the lockfile, tests, typechecks and builds. Do not force-push or replace main history. Private-host development commits and sanitized public commits may have different SHAs; record both in the delivery report.

## Future Pages

The manual Pages workflow remains inactive. Do not run it in this release. Vite base-path configuration and the root callback remain compatible with a later static host. Before migration, validate callback origin, denied accounts, deployment-cache consistency, large-team rendering and mobile touch UX. Public application hosting is separate from per-user authorization of private Linear data.
