# AI Agent 协作协议

## 必须遵守
- 默认使用中文沟通，除非用户明确指定其他语言。
- 开始新任务或 `git pull` 后，先执行 `git status`，再阅读 `docs/STATUS.md`、`docs/HANDOFF.md` 和 `docs/AGENT_INDEX.md`。
- 修改代码或项目文档前，先简短说明计划。
- 不要擅自删除文件，不要还原、覆盖或格式化无关的用户/其他 Agent 改动。
- 不提交密钥、Token、Cookie、`.env` 私有配置、运行产物、临时分析输出或设计工具缓存。
- 遵守现有 Fastify + TypeScript + Drizzle 分层、命名、响应格式、错误码、幂等和验证命令。
- 在 Windows PowerShell 中读取/搜索文本时显式使用 UTF-8，例如 `Get-Content -Encoding UTF8`、`Select-String -Encoding UTF8`；写入文本也必须使用 UTF-8。
- 做 review 时优先指出 bug、风险、行为回归和测试缺口，结论放在问题之后。

## 阅读路由
- L0：本文件只放最高优先级规则和入口，不承载长流程。
- L1：需要任务类型路由时读取 `docs/AGENT_INDEX.md`，并只选择一个 `docs/routes/` 路由文件。
- L2：读取选中的路由文件后，只补读它点名的具体文档和相关源码。
- 项目业务、架构、API、数据库、安全和部署设计优先看 `backend_ai_docs/` 中的权威文档。
- 工作子目录若以后出现自己的 `AGENTS.md`，进入该子树修改前读取其增量规则。
- 不要默认全量读取 `docs/`、`backend_ai_docs/` 或整个仓库。

## 阶段结束清单
- 更新 `docs/STATUS.md`，写清完成内容、下一步、风险和验证结果。
- 更新 `docs/HANDOFF.md`，让下一位 Agent 能从当前状态继续。
- 如有架构、产品或协作流程决策，更新 `docs/DECISIONS.md`。
- 如优先级或里程碑变化，更新 `docs/ROADMAP.md`。
- 运行与改动匹配的验证命令；无法运行时记录原因。
- 阶段任务完成且工作树只包含本任务相关改动时，使用中文 Conventional Commit 提交；若存在无关脏改动，只提交本任务文件。
