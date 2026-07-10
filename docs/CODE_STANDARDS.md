# 代码规范

## 分层和职责
- `src/common/` 存放错误、响应、中间件、校验、工具等底层公共能力，不依赖业务模块。
- `src/infrastructure/` 存放数据库、配置、日志、token、微信登录等基础设施适配。
- `src/modules/*/` 按业务模块组织 route、service、repository、dto、memory repository 和 postgres repository。
- 数据库 schema 和迁移位于 `src/infrastructure/database/schema.ts` 与 `src/database/migrations/`。
- 根目录 `AGENTS.md` 只放硬规则和 L0 入口。
- `docs/AGENT_INDEX.md` 只做 L1 任务类型路由。
- `docs/routes/*.md` 做 L2 任务子类型路由，指向具体单一职责文档。
- 业务、架构、API、数据库、安全和部署设计放在 `backend_ai_docs/`，不要复制成多份权威来源。

## 业务更新原则
- 新增功能先拆模块边界，再补 DTO 校验、service 编排、repository 抽象、内存实现、PostgreSQL 实现和测试。
- 只设计和实现 `GET`、`POST` 两类公开 HTTP 请求；更新、删除、恢复等动作使用语义化 `POST /xxx/update`、`POST /xxx/delete`、`POST /xxx/restore`。
- 写接口必须支持 `clientMutationId` 幂等；重复提交同一用户下的同一 mutation 应返回首次处理结果或幂等成功。
- 会影响前端同步的实体必须写同步日志或更新同步水位。
- 删除优先软删除，安全敏感动作写审计日志。
- 页面状态不等于后端模型，表结构应表达业务实体和约束。

## 复用原则
- 同一能力只保留一个权威实现，先复用 `common/`、`infrastructure/` 和模块内现有 helper。
- 出现第二处相似逻辑时优先提取复用或补抽象。
- 新增加密算法、认证来源、同步冲突策略、通知渠道时，优先新增适配器或策略实现，不直接改散核心流程。

## 注释与文档
- 重要业务函数、类和工具函数保持 JSDoc，说明用途、参数、返回值、异常或副作用。
- 注释重点解释业务意图、关键分支、边界条件和容易误读的处理，不写机械复述。
- 改变公开 API、数据库 schema、安全规则、部署方式或协作流程时，同步更新相关文档。

## 错误处理
- 使用统一错误类型和稳定错误码，错误响应保持统一外层结构。
- 对用户返回友好消息，不暴露内部栈、SQL、密钥、token 或实现细节。
- 日志不得记录手机号、邮箱、经期备注、备份快照明文、密文 payload、token 或 session key。

## 测试要求
- 常规验证优先运行 `npm test`，它包含 typecheck 和默认集成测试。
- PostgreSQL 仓储测试使用 `npm run test:postgres`，必须显式配置独立测试库和 `RUN_POSTGRES_TESTS=1`。
- 新增或修改写接口时覆盖幂等、失败路径、同步日志和权限边界。
- 涉及周期记录时覆盖重叠校验；涉及备份时覆盖创建、恢复审计、软删除和保留策略；涉及隐私时覆盖配置切换、密钥版本和 vault item。

## 安全要求
- 不提交密钥、Cookie、Token、`.env` 私有配置或私有数据。
- refresh token 只保存哈希；微信 `session_key` 不落库，不返回前端。
- 经期记录、用户资料、备份快照和隐私数据按敏感数据处理。
- 本地配置、运行产物、原型/设计工具缓存和临时分析输出应加入忽略规则。

## 提交规范
- 阶段任务完成且项目协议要求提交时，按功能点、修复点或文档点拆分提交。
- 一个 commit 只表达一个主题，不混入无关格式化、重构、依赖或业务改动。
- commit message 遵循 Conventional Commits：`<type>(<scope>): <subject>`，subject 使用简洁中文。
- 常用类型包括 `feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`。
