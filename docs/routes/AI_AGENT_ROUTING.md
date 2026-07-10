# AI Agent Routing

用于调整 AI Agent 协作规则、交接结构、文档路由、review 流程和共享记忆。

| 任务 | 读取 |
|---|---|
| 修改根 Agent 规则 | `AGENTS.md`、`docs/AGENT_INDEX.md`、本文件 |
| 修改文档路由 | `docs/AGENT_INDEX.md`、相关 `docs/routes/*.md`、`docs/ai-agent/README.md` |
| 精简臃肿 Agent 文档 | `AGENTS.md`、`docs/AGENT_INDEX.md`、`docs/ai-agent/README.md` |
| 初始化或刷新协作文档 | 使用 `$multi-agent-project-handoff`，并读取其 `SKILL.md` 和必要参考文件 |
| 记录协作规则变化 | `docs/DECISIONS.md`、`docs/STATUS.md`、`docs/HANDOFF.md` |
| 做代码 review | `AGENTS.md`、`docs/CODE_STANDARDS.md`、相关源码和测试 |

保持 `AGENTS.md` 精简。长期流程放入 `docs/ai-agent/`，一次性分析或版本差异放入 `docs/change-diffs/`。
