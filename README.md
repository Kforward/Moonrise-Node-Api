# Moonrise Node API

Moonrise Node API 是面向 Moonrise 小程序/前端应用的后端服务，当前运行骨架为 Node.js + TypeScript + Fastify。项目已从早期 Koa/MySQL 示例工程改造为前端可直接联调的后端 API，核心目标是承接用户身份、周期数据、跨设备同步、云端备份和后续隐私加密能力。

## 当前状态

已落地能力：

- `auth`：微信小程序登录、开发期 mock 登录、access/refresh token、设备会话、退出登录。
- `users`：当前用户资料读取/更新、设备列表、设备注销。
- `cycle`：周期设置、经期记录创建/编辑/完成/软删除、日期重叠校验。
- `sync`：同步日志、同步水位、增量拉取、`/sync/push` 批量离线变更处理、幂等响应快照。
- `backup`：云端备份快照创建、列表、详情、恢复审计、软删除、最近 5 条有效快照保留策略。
- `audit`：内部审计日志能力，已被登录、设备、备份等流程调用。
- PostgreSQL/Drizzle：完整 schema 和迁移文件已落地，`auth`、`users`、`cycle`、`sync`、`idempotency`、`backup` 已具备内存/PostgreSQL 双仓储实现。

仍是占位或待扩展能力：

- `privacy`：隐私配置、加密模式、密钥版本、端到端加密条目托管仍是占位路由。
- PostgreSQL 集成测试、安全失败路径测试、限流等生产强化能力仍需继续补齐。

## 技术栈

- Runtime：Node.js + TypeScript
- HTTP 框架：Fastify
- 校验：Zod
- 数据库：PostgreSQL + Drizzle ORM
- 开发期存储：进程内 memory repository，便于前端本地联调
- Token：JWT access token + refresh token，refresh token 只保存哈希
- 测试：Node.js 内置 test runner + `tsx`

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

默认端口为 `8000`，健康检查：

```bash
GET http://localhost:8000/api/v1/health
```

常用脚本：

```bash
npm run dev              # 本地开发，tsx watch
npm run build            # TypeScript 编译到 dist
npm start                # 运行 dist/main.js
npm test                 # typecheck + integration tests
npm run lint             # ESLint 检查 src
npm run typecheck        # TypeScript 类型检查
npm run test:integration # 仅运行集成测试
```

## 环境变量

`.env.example` 包含当前支持的配置：

```bash
NODE_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
API_PREFIX=/api/v1
CORS_ORIGIN=*
LOG_LEVEL=info

DATABASE_DRIVER=memory
DATABASE_URL=postgresql://moonrise:moonrise_password@localhost:5432/moonrise

JWT_ACCESS_SECRET=change-me-access-secret
JWT_REFRESH_SECRET=change-me-refresh-secret

WECHAT_LOGIN_MODE=mock
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
```

说明：

- `DATABASE_DRIVER=memory` 是默认开发模式，不需要本地 PostgreSQL。
- `DATABASE_DRIVER=memory` 的数据只保存在当前进程内，服务重启后会清空，适合前端快速联调。
- `DATABASE_DRIVER=postgresql` 会启用 Drizzle/PostgreSQL 仓储，需要配置 `DATABASE_URL` 并执行迁移。
- 开发环境默认 `WECHAT_LOGIN_MODE=mock`，前端可用任意非空 `code` 联调登录。
- 真实微信登录使用 `WECHAT_LOGIN_MODE=code2session`，并配置 `WECHAT_MINIPROGRAM_APP_ID` 与 `WECHAT_MINIPROGRAM_APP_SECRET`。
- 生产环境必须使用 `code2session`；微信 `session_key` 不落库，也不会返回前端。

## 数据库

当前 schema 位于 `src/infrastructure/database/schema.ts`，迁移文件位于 `src/database/migrations/`。

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

当前集成测试默认强制使用 `DATABASE_DRIVER=memory`。切换到 PostgreSQL 模式前，请先确认目标数据库已创建并完成迁移。

已建核心表包括：

- `app_users`
- `auth_identities`
- `user_devices`
- `user_profiles`
- `cycle_settings`
- `period_records`
- `sync_change_logs`
- `idempotency_records`
- `backup_snapshots`
- `audit_logs`
- `privacy_configs`
- `encrypted_vault_items`

## API 概览

所有接口默认前缀为 `/api/v1`。成功响应统一为：

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "request-id"
}
```

错误响应也保持同一外层结构，`success` 为 `false`，`code` 为稳定错误码，`message` 可直接用于前端提示，`requestId` 可用于排查日志：

```json
{
  "success": false,
  "code": "VALIDATION_FAILED",
  "message": "请求参数不合法",
  "data": null,
  "requestId": "request-id"
}
```

除登录和刷新 token 外，当前业务接口均需要请求头：

```http
Authorization: Bearer <accessToken>
x-request-id: <optional-client-request-id>
```

`x-request-id` 可选；如果前端未传，服务端会自动生成，并在响应头与响应体中返回。

前端开发期推荐先使用 mock 微信登录获取 token：

```http
POST /api/v1/auth/wechat/login
Content-Type: application/json
```

```json
{
  "code": "dev-code",
  "deviceKey": "local-device-001",
  "deviceName": "开发设备",
  "platform": "mp-weixin"
}
```

认证：

- `POST /auth/wechat/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/session`

用户：

- `GET /users/me`
- `POST /users/me/update`
- `GET /users/me/devices`
- `POST /users/me/devices/revoke`

周期：

- `GET /cycle/settings`
- `POST /cycle/settings/update`
- `GET /cycle/records`
- `POST /cycle/records/create`
- `POST /cycle/records/update`
- `POST /cycle/records/delete`
- `POST /cycle/records/finish`

同步：

- `GET /sync/changes?afterVersion=0&limit=100`
- `POST /sync/push`
- `GET /sync/state`

备份：

- `GET /backups`
- `POST /backups/create`
- `GET /backups/detail?id=<snapshotId>`
- `POST /backups/restore`
- `POST /backups/delete`

隐私安全：

- `GET /privacy/config`：占位，当前返回 `501 NOT_IMPLEMENTED`
- `POST /privacy/config/update`：占位，当前返回 `501 NOT_IMPLEMENTED`
- `POST /privacy/vault-items/save`：占位，当前返回 `501 NOT_IMPLEMENTED`
- `GET /privacy/vault-items`：占位，当前返回 `501 NOT_IMPLEMENTED`

更详细的请求体和业务规则请看 `backend_ai_docs/03_api_design.md` 与 `backend_ai_docs/02_business_rules.md`。

## 幂等与同步

已接入业务数据写入的接口需要携带 `clientMutationId`，包括用户资料更新、设备注销、周期设置、经期记录、备份操作，以及 `/sync/push` 中的每条离线变更。服务端会保存首次响应快照，重复提交同一用户下的同一个 `clientMutationId` 时返回首次处理结果。

当前会写入同步日志的实体：

- `user_profile`
- `cycle_settings`
- `period_record`
- `backup_snapshot`

`/sync/push` 当前支持批量提交：

- `user_profile.update`
- `cycle_settings.update`
- `period_record.create`
- `period_record.update`
- `period_record.delete`
- `period_record.finish`

单条离线变更失败不会阻断后续变更，响应会逐条返回成功或失败结果。

## 备份策略

备份模块只保存快照密文和必要元数据。列表接口只返回元数据，详情接口才返回 `snapshotCiphertext`。

当前策略：

- 创建、恢复、删除备份都会写审计日志。
- 创建、恢复、删除备份都会写同步日志。
- 同一用户保留最近 5 条有效快照，较早快照会被自动软删除。
- `clientBackupId` 用于前端本地备份映射，不允许重复。

## 测试覆盖

当前集成测试覆盖：

- 微信 mock 登录
- refresh token 轮换与旧 token 失效
- 用户资料更新幂等
- 经期记录幂等创建
- 经期记录重叠校验
- 同步日志与同步水位
- `/sync/push` 批量成功、局部失败和重复提交
- 备份快照创建、列表、详情、恢复审计、软删除和最近 5 条保留策略

运行：

```bash
npm test
```

## 目录结构

```text
src/
  app.ts
  main.ts
  common/
    errors/
    handlers/
    middlewares/
    responses/
    validators/
  infrastructure/
    config/
    database/
    logger/
    tokens/
    wechat/
  modules/
    audit/
    auth/
    backup/
    cycle/
    health/
    privacy/
    sync/
    users/
test/
  integration/
backend_ai_docs/
  00_backend_prd.md
  01_architecture.md
  02_business_rules.md
  03_api_design.md
  04_database_design.md
  05_security_design.md
  06_ai_dev_rules.md
  07_migration_roadmap.md
```

## 文档地图

- `backend_ai_docs/README.md`：AI 文档入口。
- `backend_ai_docs/00_backend_prd.md`：后端产品范围和阶段目标。
- `backend_ai_docs/01_architecture.md`：后端架构、模块边界、推荐技术栈。
- `backend_ai_docs/02_business_rules.md`：周期、同步、备份、隐私安全业务规则。
- `backend_ai_docs/03_api_design.md`：API 草案、响应格式、幂等和分页规则。
- `backend_ai_docs/04_database_design.md`：数据库表设计、字段说明、索引与约束。
- `backend_ai_docs/05_security_design.md`：数据安全、认证、审计和恢复策略。
- `backend_ai_docs/06_ai_dev_rules.md`：AI 开发规范。
- `backend_ai_docs/07_migration_roadmap.md`：改造路线与当前优先级。
- `backend_ai_docs/database/001_initial_schema.sql`：PostgreSQL 建表草案。

## 下一步优先级

当前路线请以 `backend_ai_docs/07_migration_roadmap.md` 为准。近期优先事项：

- 落地 `privacy` 模块真实业务。
- 扩展 PostgreSQL 仓储集成测试。
- 补充安全失败路径测试与限流能力。
