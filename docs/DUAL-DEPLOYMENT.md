# 双目标部署

同一个 Git SHA 生成 Vercel 根路径与 GitHub Pages 仓库子路径的静态外壳。CI 的矩阵分别测试两个构建和 ELK Worker。Node major 由 .nvmrc 指定，CI 记录 Node/npm，Vercel 项目使用同一 major。

| 配置 | Vercel Preview | GitHub Pages |
| --- | --- | --- |
| 基础路径 | / | /Linear-Gragh-Explorer/ |
| 入口保护 | Vercel Authentication | 公开应用外壳 |
| OAuth 回调 | 已注册的稳定受保护分支别名 | 以实际 Pages 配置确认的 HTTPS 入口，含末尾斜杠 |
| 发布 | 受保护分支 Preview | 默认分支手动 workflow_dispatch，需单独批准 |

Pages 发布前确认 Settings → Pages 实际地址，向同一 workspace-private Linear app 添加完全匹配的 redirect，并配置仓库变量 LINEAR_CLIENT_ID、LINEAR_REDIRECT_URI。预计入口为 https://horacech.github.io/Linear-Gragh-Explorer/ 。工作流读取实际 Pages base_url 进行比较，缺少配置、审计或产物验证失败时不上传。没有启用 Pages 的仓库须另行获得所有者授权。

公开 Client ID 可编入外壳。用户自行通过只读 PKCE 登录，权限取决于 Linear。Token 与任务快照仅在内存中。各 origin 的浏览器本地配置独立。区域可达性与已注册 Pages 回调的端到端测试仍待实际环境验证。


## 发布入口与核验

Vercel 正式回调为 `https://linegraph.vercel.app/`。lgraph.vercel.app 与 linear-graph-explorer.vercel.app 是指向该入口的 308 别名。保留 Preview SSO 与稳定分支回调。Pages 使用 `https://horacech.github.io/Linear-Gragh-Explorer/`，GitHub Actions Source 和强制 HTTPS。两个正式 URI 均须在同一个私有 Linear 应用中逐项登记。浏览器地址栏和页脚应分别匹配实际主机与正式 SHA。发布前确认成员独立授权的私有团队差异；首次部署没有可供回滚的生产实例，如需恢复应撤回入口并重新验收已审查的提交。
