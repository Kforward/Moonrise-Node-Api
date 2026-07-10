# Skill Routing

用于选择、创建、更新、安装或验证 Codex Skill。当前仓库不是 Skill 仓库，只有任务明确涉及 Skill 时才使用本路由。

| 任务 | 读取 |
|---|---|
| 判断是否需要某个 Skill | 当前会话可用 Skills 列表、`AGENTS.md`、任务描述 |
| 创建或更新仓库内 Skill | 目标 `skills/<name>/SKILL.md`、相关资源、该 Skill 的官方创建规范 |
| 更新多 Agent 交接流程 | `$multi-agent-project-handoff` 技能说明、`docs/AGENT_INDEX.md`、`docs/routes/AI_AGENT_ROUTING.md` |
| 安装或验证 Skill | 对应 Skill 安装说明、仓库脚本和验证命令 |

Skill 变更完成后，按该 Skill 的验证要求运行检查，并同步更新 `docs/STATUS.md` 和 `docs/HANDOFF.md`。
