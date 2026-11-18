# v0.3.1 依赖安全记录

在 d453de5 的干净检出执行 npm ci、npm ls --all、npm audit --json 和 npm audit --omit=dev --json。npm 最初标记 7 个包（1 Moderate、4 High、2 Critical）；运行时依赖报告为 0。计数中包括继承了下游公告的包。

| 包与原锁定版本 | 来源与执行位置 | 公告、影响范围及处置 |
| --- | --- | --- |
| vitest 3.2.7 | 直接开发依赖，Node CI | 受 mocker、tinypool 和 glob 链影响。升至支持 Vite 7、Node 22 的 4.1.12。仍继承 glob 告警。 |
| @vitest/mocker 3.2.7 | 传递测试依赖 | 路径读取影响 2.1.0 至 4.1.11 之前，手工 mock 注册影响 2.1.0-beta.7 至 4.1.12 之前。升级至 4.1.12。[公告一](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) · [公告二](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) |
| tinypool 1.1.1 | 传递测试依赖，Node worker | 两条 worker 选项相关公告分别涉及 ≤2.1.0 与 <2.1.2。Vitest 4 的依赖树已移除此包。[公告一](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) · [公告二](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) |
| picomatch 4.0.7 | 传递构建和测试依赖 | ≤4.0.7 的复杂 glob 匹配存在 ReDoS。检查时 npm 最新发布为 4.0.7。保留上游待修，阻止公开发布。[公告](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) |
| fdir 6.5.0、tinyglobby 0.2.17 | 传递构建依赖 | 继承 picomatch 风险。更新上游后需重新解析锁文件。 |
| vite 7.3.8 | 直接构建依赖 | 继承上述文件匹配风险。发布物只包含静态资源。CI 使用仓库中的匹配模式，仍应限制构建权限并审查分支。 |

修复后完整审计为 5 High、0 Critical，均通过同一 glob 公告传播。生产依赖审计为 0。Playwright 1.65.1、React Flow 12.12.1、ELKjs 0.11.1 与 esbuild 0.28.2 未收到此次直接告警。未知漏洞与后续公告不在上述计数中。

esbuild 来自 lockfile 固定的 npm 包，install.js 检查本机平台的可选二进制依赖、验证版本，缺少时包含下载回退。本环境保留标准平台依赖后，使用 npm ci --ignore-scripts 可以构建。维持现有脚本许可，不为其他包开启脚本。公开发布前重新执行完整审计，处置尚存的构建链 High。

## v0.3.2

v0.3.2 保留原依赖版本。本轮 npm ci 和 npm ls --all 后，完整审计仍列出 5 High，omit=dev 为零。公开 Pages workflow 在上传前执行完整 High 门禁。


## v0.3.3 · CVE-2026-112366 recheck (2026-11-18)

The current GitHub-reviewed advisory identifies picomatch versions through 4.0.7 as affected and lists no patched version. The NVD record likewise identifies the affected range through 4.0.7. Secondary sources have conflicting claims about a 4.0.8 fix; do not override the primary GitHub advisory or assume a fixed release until the upstream package and advisory are updated and the patch is verified.

- Production dependency audit is now an explicit CI step: `npm audit --omit=dev --audit-level=high`.
- The manual GitHub Pages release workflow retains the full `npm audit --audit-level=high` gate. It therefore remains blocked while the development-tool advisory is reported as High.
- Do not suppress the finding or pin to an unofficial fork for the purpose of making a release green.
- Re-run the full audit against the exact release lockfile before Vercel Production or Pages publication.

Primary sources: [GitHub advisory GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), [NVD CVE-2026-112366](https://nvd.nist.gov/vuln/detail/CVE-2026-112366).
