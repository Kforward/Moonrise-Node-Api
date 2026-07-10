# Development Routing

用于修改代码、脚本、测试、构建、架构、安全、数据库、API 或部署实现。

| 任务 | 读取 |
|---|---|
| 修改业务模块代码 | `docs/CODE_STANDARDS.md`、`backend_ai_docs/06_ai_dev_rules.md`、目标 `src/modules/*` 文件 |
| 新增或修改 API 契约 | `backend_ai_docs/03_api_design.md`、`backend_ai_docs/openapi.json`、相关 route/dto/service/test |
| 修改数据库 schema、迁移或仓储 | `backend_ai_docs/04_database_design.md`、`src/infrastructure/database/schema.ts`、`src/database/migrations/`、相关 repository |
| 修改认证、隐私、加密、审计或安全失败路径 | `backend_ai_docs/05_security_design.md`、`docs/CODE_STANDARDS.md`、相关模块 |
| 修改部署、环境变量或运行方式 | `README.md`、`backend_ai_docs/08_production_deployment.md`、`.env.example`、`.env.production.example`、相关配置文件 |
| 修改构建、测试、lint 或维护脚本 | `README.md`、`package.json`、`docs/CODE_STANDARDS.md` |
| 准备提交 | `docs/CODE_STANDARDS.md`、`docs/STATUS.md`、`docs/HANDOFF.md` |

验证优先级：常规改动运行 `npm test`；只改文档至少检查链接和占位内容；PostgreSQL 改动在具备独立测试库时再运行 `npm run test:postgres`。
