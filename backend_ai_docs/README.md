# Moonrise Node.js 后端 AI 文档入口

本目录用于承载当前 Moonrise Node.js 后端项目的 AI 开发文档。它沉淀产品范围、架构边界、业务规则、数据库设计、安全要求和后续改造优先级。
根目录 `README.md` 是项目总入口；当需要更细的产品、接口、数据或安全设计时，再进入本目录按文档地图补读。

## 文档地图

1. `00_backend_prd.md`：后端产品范围、当前小程序功能映射、阶段目标。
2. `01_architecture.md`：Node.js 后端架构、模块边界、推荐技术栈。
3. `02_business_rules.md`：周期记录、同步、备份、隐私安全的后端业务规则。
4. `03_api_design.md`：前后端分离 API 草案、响应格式、幂等与分页规则。
5. `04_database_design.md`：数据库表设计、字段说明、索引与约束。
6. `05_security_design.md`：数据安全、加密、认证、审计和恢复策略。
7. `06_ai_dev_rules.md`：迁移到后端项目后给 AI 使用的开发规则。
8. `07_migration_roadmap.md`：当前仓库改造成正式后端项目的保留、替换、删除和优先级路线。
9. `database/001_initial_schema.sql`：PostgreSQL 建表草案。

## 当前设计基准

- 后端语言：Node.js + TypeScript。
- 推荐运行框架：NestJS 或 Fastify，文档按“模块化 + 依赖注入 + 分层服务”约束编写。
- 推荐数据库：PostgreSQL，原因是 JSONB、索引、约束、审计字段和后续加密元数据表达更直接。
- 当前定位：先服务小程序的数据同步、备份和安全存储，不在第一阶段强制把所有预测计算迁到后端。
- 隐私原则：经期记录、用户资料、备份快照均视为敏感数据；后端默认不保存明文密钥。

## 使用方式

后端 Codex 或其他 AI 进入本项目时，应优先阅读根目录 `README.md`，再阅读本文件、`07_migration_roadmap.md`、`00_backend_prd.md` 和 `06_ai_dev_rules.md`。如果后续拆分独立仓库，可整体复制 `backend_ai_docs/` 作为设计基准。

## Codex 启动优先级

每次 Codex 进入当前仓库时，先阅读 `07_migration_roadmap.md` 判断当前改造阶段和优先事项，再根据具体任务补读产品、架构、数据库、安全和开发规则文档。
