# Moonrise Node.js 后端 AI 文档入口

本目录用于承载未来 Node.js 后端项目的 AI 开发文档。它与当前小程序工程保持分离，后续可以整体迁移到独立后端仓库中使用。
根目录 `README.md` 已同步收录本入口说明，优先以根目录文档作为项目总入口。

## 文档地图

1. `00_backend_prd.md`：后端产品范围、当前小程序功能映射、阶段目标。
2. `01_architecture.md`：Node.js 后端架构、模块边界、推荐技术栈。
3. `02_business_rules.md`：周期记录、同步、备份、隐私安全的后端业务规则。
4. `03_api_design.md`：前后端分离 API 草案、响应格式、幂等与分页规则。
5. `04_database_design.md`：数据库表设计、字段说明、索引与约束。
6. `05_security_design.md`：数据安全、加密、认证、审计和恢复策略。
7. `06_ai_dev_rules.md`：迁移到后端项目后给 AI 使用的开发规则。
8. `database/001_initial_schema.sql`：PostgreSQL 建表草案。

## 当前设计基准

- 后端语言：Node.js + TypeScript。
- 推荐运行框架：NestJS 或 Fastify，文档按“模块化 + 依赖注入 + 分层服务”约束编写。
- 推荐数据库：PostgreSQL，原因是 JSONB、索引、约束、审计字段和后续加密元数据表达更直接。
- 当前定位：先服务小程序的数据同步、备份和安全存储，不在第一阶段强制把所有预测计算迁到后端。
- 隐私原则：经期记录、用户资料、备份快照均视为敏感数据；后端默认不保存明文密钥。

## 迁移方式

将整个 `backend_ai_docs/` 复制到后端仓库根目录。后端 Codex 或其他 AI 进入后端项目时，应优先阅读本文件，再阅读 `00_backend_prd.md` 和 `06_ai_dev_rules.md`。
