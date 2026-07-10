# 项目说明

## 目标
Moonrise Node API 是面向 Moonrise 小程序/前端应用的后端服务，负责用户身份、设备会话、周期数据、跨设备同步、云端备份、隐私配置和端到端加密密文托管。

## 范围
- Node.js + TypeScript + Fastify 后端 API。
- PostgreSQL + Drizzle schema、迁移和 PostgreSQL 仓储实现。
- 开发期内存仓储，方便前端本地联调。
- `auth`、`users`、`cycle`、`sync`、`backup`、`privacy`、`audit` 模块。
- OpenAPI 契约、后端设计文档、生产部署说明和多 Agent 协作交接文档。

## 非目标
- 第一阶段不强制把所有周期预测计算迁到后端，后端主要保存记录和设置。
- 不保存微信 `session_key`、refresh token 明文、端到端加密主密钥或敏感明文日志。
- 不把前端页面状态直接设计成后端数据表。
- 不在默认测试中自动清理或操作非测试 PostgreSQL 数据库。

## 用户/使用场景
- Moonrise 前端通过微信登录获取 access/refresh token。
- 用户跨设备同步资料、周期设置、经期记录、隐私配置和加密 vault item。
- 用户创建、查看、恢复和软删除云端备份快照。
- 开发者可在 `DATABASE_DRIVER=memory` 下快速联调，也可显式切换 PostgreSQL 做仓储集成验证。

## 关键约束
- 公开业务接口默认前缀为 `/api/v1`。
- 除登录和刷新 token 外，业务接口需要 `Authorization: Bearer <accessToken>`。
- 成功和错误响应保持统一外层结构，错误码必须稳定。
- 写接口使用 `clientMutationId` 实现幂等；会影响同步的实体需要写 `sync_change_logs`。
- 删除使用软删除；安全敏感动作写审计日志。
- 生产环境必须使用真实微信 `code2session`、强随机 JWT 密钥和隔离数据库。

## 重要假设
- `backend_ai_docs/` 是业务、架构、数据库、安全和部署设计的权威来源。
- `README.md` 反映当前可运行命令；如脚本变化，需要同步更新 `README.md`、`docs/STATUS.md` 和 `docs/HANDOFF.md`。
- PostgreSQL 仓储测试需要独立测试库，并显式设置 `RUN_POSTGRES_TESTS=1`。
- Redis/多实例限流尚未落地，当前限流主要适合单进程或单实例场景。
