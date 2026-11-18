# OAuth 与账号隔离

授权请求使用 actor=user、scope=read 与 S256 PKCE。Linear 向每个授权人签发独立令牌。浏览器内存保存 access/refresh token，轮换请求合并执行。令牌交换和 GraphQL 请求均禁用浏览器缓存，省略 cookie。公共构建仅接受公开 Client ID 与回调配置。

回调消费单次 sessionStorage 事务并清理 URL。校验 state、有效期、回调地址和授权范围。旧版 pvcr-oauth 临时键保留以接住部署期间发起的回调，旧公开 Client ID 偏好可继续读取。断开会话会取消同步、清理图和审阅状态、作废迟到的令牌响应。提供方撤权需要用户在 Linear 完成。

Linear 决定该身份能够访问哪些 Team。应用按当前选择限制查询并验证结果归属；read scope 可以读取提供方允许的其他 Team。关系外端点只显示匿名占位。Team Profile 与上次选择按 Workspace ID 和 Viewer ID 分区，Profile 另加 Team ID。旧版配置没有所有者记录，默认保持原处，用户确认归属后可在团队配置中迁移。共享设备应使用独立浏览器账号，本地偏好没有加密。导出含成员映射，请私下保管。

Private OAuth App 的分发限于创建它的 Workspace；跨 Workspace 接入需可供相应工作区授权的应用，并遵守管理员安装策略。当前注册类型要由创建者在 Linear 设置中核实；源码无法判定当前 App 的分发设置。本版本每次连接一个 Workspace。
