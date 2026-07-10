# Agent Route Index

本文件只用于选择下一份路由文件，不是完整文档地图。每次先选一个最贴近当前任务的路由，再按该路由点名的文档继续。

## 按任务选择路由

| 任务类型 | 下一份路由 |
|---|---|
| 恢复项目、了解当前状态、路线、决策或项目边界 | `docs/routes/PROJECT_ROUTING.md` |
| 修改代码、脚本、测试、构建、架构、安全或部署实现 | `docs/routes/DEVELOPMENT_ROUTING.md` |
| 创建、更新、选择、安装或验证 Codex Skill | `docs/routes/SKILL_ROUTING.md` |
| 调整 AI Agent 协作、交接、review、文档路由或共享记忆 | `docs/routes/AI_AGENT_ROUTING.md` |
| 比较版本、需求、接口或功能差异 | `docs/routes/CHANGE_ROUTING.md` |

## 控制上下文
- 先且只先读取一个路由文件，再读取它点名的具体文档。
- 优先按任务精准读取，不要把 `docs/`、`backend_ai_docs/` 或源码全量塞进上下文。
- 如果任务跨类型，先完成当前路由需要的理解；任务性质变化时再回到本文件重新选路由。
- 如果未来某个子目录出现自己的 `AGENTS.md`，只有修改该子树时才读取它。
