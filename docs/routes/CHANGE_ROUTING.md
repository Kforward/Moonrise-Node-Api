# Change Routing

用于比较版本、需求、接口、数据库或功能差异，并沉淀一次性分析。

| 任务 | 读取 |
|---|---|
| 比较新需求与现有行为 | `docs/change-diffs/README.md`、相关 `backend_ai_docs/` 设计文档、相关源码 |
| 记录功能级差异 | `docs/change-diffs/README.md`、`docs/STATUS.md`、相关业务文档 |
| 比较 API 契约变化 | `backend_ai_docs/03_api_design.md`、`backend_ai_docs/openapi.json`、相关 route/dto/test |
| 比较数据库或迁移变化 | `backend_ai_docs/04_database_design.md`、schema、迁移文件、相关 repository |
| 差异导致路线变化 | `docs/ROADMAP.md` |
| 差异导致产品或架构选择 | `docs/DECISIONS.md` |

长期稳定流程沉淀到 `docs/ai-agent/`；一次性版本、需求或功能差异放到 `docs/change-diffs/`。
