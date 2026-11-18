# Release readiness

## Acceptance decisions

| Decision | Evidence required | Current boundary |
| --- | --- | --- |
| Merge a code change | Review of the exact diff, green CI for the proposed head, documented residual risks and owner decision | PR #1 and #2 are merged. Review the independent v0.3.1 release branch against main. |
| Use the owner-private preview | Successful deployment with owner-only access and smoke tests on the deployed build | The previous v0.2 preview passed two-team live testing. Keep subsequent deployment results and commit mappings in the private acceptance report. |
| Publish the application shell | Explicit release approval, validated public artifact, registered canonical callback, accepted privacy and operational risks | Public deployment is pending. Subpath checks run without contacting Linear or publishing Pages. |

Real two-reviewer approval acceptance pending external evidence. Only actual markers from distinct configured reviewers in a verified current round establish this result. The authenticated private preview can be used to inspect pending work while this evidence is outstanding. A genuine denied or revoked account, mobile device checks and deployment-cache validation each need independent evidence. Refer to [verification](VERIFICATION.md), [performance](PERFORMANCE.md) and [UX audit](UX-AUDIT.md) for the scope of each run.

## Public-shell preparation

A local production build for the repository subpath resolved the main script, stylesheet and graph worker. Artifact checks reject unexpected root files, symlinks, source maps, common credential signatures and incorrect resource paths. CI builds the Pages variant without publishing. The manual workflow validates the artifact again before upload and restricts deployment permissions to the deploy job.

Before authorizing public deployment, verify current provider redirect settings, site-origin isolation, read-only auth and cross-Team tests. Inspect the diff and distributable for private content, including any added public asset. The release owner must explicitly accept or close the remaining real-account and operational risks. First live host checks include OAuth callback, cache consistency, ELK worker loading and a reload with a prior tab open. Public-source code, public shell hosting and access to real task data have separate permission boundaries.

## Version mapping

Public v0.2 baseline audited from PR #1: `8125c7f893bbff5df8ee88e7304044dfc9d7b62b`. Private hosting uses separate commits and a deployment manifest. Compare application source contents, package lockfile and build inputs before declaring equivalence. Record the paired SHAs and deployment receipt privately. See the PR's final CI status for the candidate under review.

## v0.3.1 发布门禁

保护预览须分别验收别名和部署 URL。内部真实使用须验证稳定 OAuth 回调。合并须审核候选 SHA 与 CI。公开发布另需负责人批准、真实账号权限验证和可恢复部署记录。参考 [多用户验收](MULTI-USER-ACCEPTANCE.md) 与 [回滚](ROLLBACK.md)。

公开发布还须通过完整构建依赖审计。当前 picomatch 的 High 记录与验证范围见 [依赖安全记录](DEPENDENCY-SECURITY.md)。
