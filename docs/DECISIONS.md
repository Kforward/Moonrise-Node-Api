# 决策记录

## 记录格式
- 日期：
- 决策：
- 背景：
- 取舍：
- 影响：

## 决策

### 2026-07-10 - 初始化多 Agent 协作交接文档
- 决策：使用仓库文档和 L0/L1/L2 分级路由作为多端、多 AI Agent 协作的共享记忆。
- 背景：不同客户端和 Agent 不能天然共享完整聊天上下文，当前仓库已有 `backend_ai_docs/` 业务设计文档，但缺少统一的接手、路由、状态和阶段交接入口。
- 取舍：新增薄 `AGENTS.md`、`docs/AGENT_INDEX.md` 和 `docs/routes/*.md` 做协作路由；保留 `backend_ai_docs/` 作为业务、架构、API、数据库、安全和部署的权威来源，避免复制多份设计事实。
- 影响：后续阶段结束时需要同步更新 `docs/STATUS.md` 和 `docs/HANDOFF.md`；新增决策更新本文件；路线变化更新 `docs/ROADMAP.md`；新增长期文档时同步更新对应路由。

### 2026-07-10 - 接受小程序端 CBC+HMAC 密文信封算法
- 决策：备份、隐私配置和 vault item 算法契约接受 `aes-256-cbc-hmac-sha256`，并通过 PostgreSQL enum 迁移追加该值。
- 背景：当前前端小程序端基于 CryptoJS 实现客户端自持密钥的 AES-256-CBC + HMAC-SHA256 认证密文信封，后端原契约只允许 `aes-256-gcm` 和 `xchacha20-poly1305`，会拒绝前端实际可上传的密文 payload。
- 取舍：后端只做算法枚举、密文、摘要、密钥版本和 encrypted/algorithm 一致性校验，不保存密钥、不解密密文正文；继续保留 `aes-256-gcm` 和 `xchacha20-poly1305` 作为后续更强客户端能力或原生能力的可选算法。
- 影响：已有数据库需要执行 `0003_lumpy_may_parker.sql` 迁移；OpenAPI 和后端设计文档已同步新枚举。密钥恢复、可信设备和换机恢复仍由后续端到端加密方案设计。
