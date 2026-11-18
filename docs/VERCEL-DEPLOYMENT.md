# Vercel 部署

GitHub 是唯一源码来源。现有私有 Site 保留开发用途。Vercel 使用仓库根目录、Vite、npm ci 和 dist。构建命令同时检查允许的文件、ELK Worker 路径及资源哈希。Pages 继续使用同一源码和现有手动工作流。

1. 在目标 Vercel Team 为本仓库安装 GitHub App。关联项目时跳过首次部署。先核对套餐、用量与项目权限。
2. 在项目启用覆盖所有 Preview 的 Vercel Authentication，检查例外、共享链接及 bypass 设置。用退出登录的独立浏览器逐一打开唯一部署地址与分支别名，均应出现授权门禁。再用获准账号验证静态资源及 Worker。应用内的 Linear 登录属于第二层授权。
3. Production Branch 设为 main。在项目设置启用生产构建忽略命令 `test "$VERCEL_ENV" = production`，退出码 0 跳过。仓库配置也关闭 main 的 Git 自动部署。首次关联时 main 可能尚未包含此配置，应先确认项目门禁。限制可从控制台或 CLI 发布的成员。
4. PR 预览默认可使用合成数据。真实登录需要稳定 HTTPS 别名、Linear 精确注册的 redirect URI 以及同值的 VITE_LINEAR_REDIRECT_URI。只在需要的环境设置公开 Client ID。随机部署地址会禁用真实登录。
5. 上线需单独批准。在批准后从通过 CI 的确切 SHA 创建未绑定正式域名的 staged production 构建，在稳定授权测试入口完成冒烟，由发布负责人晋升至唯一正式域名。正式回调须在该域名独立实测。如当前套餐缺少所需暂存或保护能力，暂停发布。
6. 记录 PR、SHA、部署 ID、环境、保护范围、验证时间、批准人和上一个可回滚部署。浏览器检查入口响应 no-store、哈希资源 immutable 和 CSP。GraphQL 与 OAuth 直接访问 Linear，Vercel CDN 只分发外壳。

本次未启用 Pages。Vercel 当前套餐及线上设置以控制台和实际匿名访问结果为准。
