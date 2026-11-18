# 多用户验收

| 场景 | 验证方式与通过条件 |
| --- | --- |
| 浏览器身份隔离 | Playwright 的两个独立 context 使用合成 token，检查各自请求的 bearer、URL 清理、退出后另一个 context 继续连接、重新登录切换身份。 |
| 本地设置 | Vitest 使用同 Team、不同 Workspace 或 Viewer 验证配置分离；旧配置须主动迁移。 |
| 真实双账号 | 两名测试者各自在独立浏览器授权。对照各自 Linear 可见 Team，覆盖至少一个只有其中一人可见的 private Team。各自退出重登并验证 Team 切换、审阅与边界节点。只私下保存汇总。待授权环境实测。 |
| 撤权与续期 | 在专用测试身份执行真实撤权，确认下次刷新清空会话。另在有效授权下执行两次续期。合成测试不能替代生产域名验收。 |
| 部署保护 | 对唯一 URL 和所有别名检查匿名访问、获准账号访问以及登录后的 Worker 加载。实际部署后执行。 |

Real two-reviewer approval acceptance pending external evidence. 在自然产生本轮有效评论前保留当前可核实状态。
