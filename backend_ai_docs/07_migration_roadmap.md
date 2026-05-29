# 07 后端改造路线与启动优先级

## 1. 目标

把当前仓库从“教学型 Koa 示例工程”改造成“面向前端小程序/前端应用的正式后端服务”，服务范围以小程序的数据同步、备份恢复、隐私保护和账户体系为核心。

## 2. 先保留什么

- 保留 `backend_ai_docs/` 作为唯一的后端设计依据。
- 保留当前项目中可复用的 HTTP 壳子能力，例如基础路由、中间件、错误处理思想。
- 保留未来可能会用到的目录占位和扩展点，不要为了清理而删除尚有价值的功能入口。
- 保留上传目录结构占位，但实际上传文件不进入仓库。

## 3. 先替换什么

- 将当前 Koa 教程式账号体系，替换为微信小程序登录、设备会话和 token 体系。
- 将 MySQL + Sequelize 的示例数据层，替换为 PostgreSQL 设计与新的后端 schema。
- 将 `goods`、`socket` 等与目标业务无关的示例模块，替换为 `auth`、`users`、`cycle`、`backup`、`privacy`、`sync`、`audit`。
- 将当前散落在 controller / middleware 里的演示逻辑，迁移为文档要求的 `common / infrastructure / modules` 分层结构。

## 4. 先删除什么

- 删除或重写与目标后端无关的示例接口、示例模型和示例数据库配置。
- 删除硬编码数据库账号、密码和本地测试常量。
- 删除不再使用的上传样例文件和演示数据文件。

## 5. 改造顺序

### 5.1 第一阶段

1. 已完成：重整项目目录结构，建立 Node.js + TypeScript + Fastify 后端正式骨架。
2. 已完成：切换配置方式，移除 MySQL + Sequelize 示例数据层和硬编码数据库账号密码。
3. 已完成：搭建统一响应、统一错误、请求 ID、健康检查和模块路由骨架。
4. 已完成：落地 `auth`、`users`、`cycle settings`、`period records` 的开发期基础接口、DTO 校验和内存仓储适配器。
5. 已完成：为 `auth`、`users`、`cycle` 接入开发期 `sync_change_logs`、幂等写入和必要审计日志。
6. 已完成：引入 PostgreSQL/Drizzle 基础设施、完整 schema 和初始迁移文件，默认仍保留内存仓储便于本地联调。
7. 已完成：为 `auth` 接入 repository 抽象、内存实现和 PostgreSQL 实现；认证审计日志可在 PostgreSQL 模式写入 `audit_logs`。
8. 已完成：为 `users` 接入 repository 抽象、内存实现和 PostgreSQL 实现；用户资料同步日志可在 PostgreSQL 模式写入 `sync_change_logs`。
9. 已完成：为 `cycle` 接入 repository 抽象、内存实现和 PostgreSQL 实现；周期设置与经期记录同步日志可在 PostgreSQL 模式写入 `sync_change_logs`。
10. 已完成：为 `sync` 接入 repository 抽象、内存实现和 PostgreSQL 实现；同步日志写入、增量拉取和同步水位读取已统一走仓储。
11. 已完成：新增 `idempotency_records` 幂等响应快照表和 PostgreSQL 仓储实现，PostgreSQL 模式不再依赖进程内快照。
12. 已完成：接入微信 `jscode2session` 登录适配器，生产环境可用真实微信 openid 绑定账号，开发环境保留显式 mock 模式。
13. 已完成：建立 Node.js 内置 test runner + `tsx` 测试入口，首批覆盖登录、refresh token、幂等写入、经期重叠校验和同步日志。
14. 已完成：实现 `/sync/push` 批量离线变更处理，支持当前已落地的用户资料、周期设置和经期记录写操作，并逐条返回成功/失败结果。
15. 已完成：落地 `backup` 模块真实接口，支持快照创建、列表、详情、恢复审计、软删除和最近 5 条有效快照保留策略。
16. 已完成：落地 `privacy` 模块真实业务，支持隐私配置读取/切换、密钥版本记录、端到端加密条目密文托管、同步日志和审计。
17. 已完成：新增 PostgreSQL 仓储可选集成测试入口，覆盖核心业务链路、幂等快照和同步日志。
18. 下一步：继续扩展 PostgreSQL 仓储边界场景，以及 Redis/多实例限流适配。

### 5.2 第二阶段

1. 已完成：落地 `sync_change_logs`、幂等写入和增量同步。
2. 已完成：落地 `backup_snapshots` 及恢复审计。
3. 已完成：落地 `privacy_configs`、`encrypted_vault_items` 和密钥版本记录。

### 5.3 第三阶段

1. 补齐 `audit_logs`、权限和恢复流程。
2. 补齐测试覆盖，优先补冲突校验、幂等、备份、PostgreSQL 仓储和安全相关测试。
3. 再考虑可选能力，如更新日志、提醒队列、实时通知等。

## 6. 文档启动顺序

每次 Codex 进入该仓库时，优先按以下顺序阅读：

1. `README.md`
2. `backend_ai_docs/README.md`
3. `backend_ai_docs/07_migration_roadmap.md`
4. `backend_ai_docs/00_backend_prd.md`
5. `backend_ai_docs/01_architecture.md`
6. `backend_ai_docs/04_database_design.md`
7. `backend_ai_docs/06_ai_dev_rules.md`

## 7. 当前最高优先级

- 继续扩展 PostgreSQL 仓储边界场景，以及 Redis/多实例限流适配。
- 任何新增代码都要遵守中文注释与 JSDoc 规则。
