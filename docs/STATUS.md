# 项目状态

## 最近更新
- 日期：2026-07-10
- 当前阶段：核心 API 已落地，进入生产化补强和多 Agent 协作规范化阶段。

## 已完成
- Fastify + TypeScript 后端骨架、统一响应、统一错误、请求 ID、健康检查和模块路由。
- `auth`、`app`、`users`、`cycle`、`sync`、`backup`、`privacy`、`audit` 主链路接口。
- PostgreSQL/Drizzle schema、迁移文件、内存/PostgreSQL 双仓储实现。
- 幂等响应快照、同步日志、备份保留策略、隐私配置和 vault item 密文托管。
- 备份、隐私配置和 vault item 算法契约已支持前端小程序端 `aes-256-cbc-hmac-sha256` 密文信封；PostgreSQL 迁移 `0003_lumpy_may_parker.sql` 已追加对应枚举值。
- 应用轻量偏好读取/幂等更新、应用更新日志列表/详情，偏好更新已接入 `user_app_preferences.update` 同步日志和 `/sync/push`。
- `backend_ai_docs/` 中产品、架构、业务规则、API、数据库、安全、路线和部署文档。
- 新增多 Agent 协作文档入口、状态、交接、路由、代码规范、决策记录和变更差异目录。

## 进行中
- 生产化补强：PostgreSQL 仓储边界测试、Redis/多实例限流、事务一致性、安全失败路径审计。
- 维护协作文档，让阶段进度、下一步、风险和验证结果可被其他 Agent 接续。

## 下一步
- 扩展 PostgreSQL 仓储边界场景，尤其是分页、幂等快照、同步日志和事务边界。
- 设计 Redis 或共享存储限流适配，替换当前单进程固定窗口限流。
- 补齐刷新 token 失败、批量同步失败、解密失败等安全失败路径审计。
- 按需收敛分页契约与 PostgreSQL 查询实现，减少内存切页。
- 配合前端真实登录流程完成后，继续联调云端密文备份创建和恢复查询链路。

## 风险和阻塞
- PostgreSQL 测试默认不会随 `npm test` 真实执行，必须使用独立测试库和 `RUN_POSTGRES_TESTS=1`。
- 当前多接口的业务写入、同步日志、审计日志和幂等快照还未完全收敛到同一事务边界。
- 多实例部署后，进程内限流无法保证全局限流效果。
- `aes-256-cbc-hmac-sha256` 是客户端自持密钥的密文信封算法，服务端只托管密文；换机恢复和密钥恢复不由后端自动解决。

## 最近验证
- `npm test`：通过，包含 `tsc --noEmit` 和 13 个默认集成测试。
- `npm run lint`：通过。
