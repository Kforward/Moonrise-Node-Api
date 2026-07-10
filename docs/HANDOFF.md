# 交接说明

## 当前上下文
- 分支：`main`
- 本次文档初始化基线提交：`db8d908 feat(docs): 更新生产环境部署说明文档，添加环境变量配置和数据库迁移流程`
- 当前目标：核心 API 与应用级业务接口已补齐；当前已同步前端小程序端隐私密文信封算法，后续重点转向 PostgreSQL 边界测试、Redis/多实例限流、事务一致性和安全失败路径审计。

## 恢复工作流程
```bash
git status
git pull --ff-only
npm install
npm test
```

PostgreSQL 仓储测试是可选强化验证，必须使用独立测试库：

```powershell
$env:RUN_POSTGRES_TESTS="1"
$env:DATABASE_URL="postgresql://moonrise_test_user:moonrise_test_password@localhost:5432/moonrise_test"
npm run db:migrate
npm run test:postgres
```

## 接手必读
- `AGENTS.md`
- `docs/STATUS.md`
- `docs/HANDOFF.md`
- `docs/AGENT_INDEX.md`
- 按 `docs/AGENT_INDEX.md` 选择一个 `docs/routes/` 路由文件，再读取任务相关文档；不要默认全读。
- 业务、架构、API、数据库、安全和部署问题再读 `backend_ai_docs/README.md` 指向的具体文档。

## 下一步建议
- 优先处理 PostgreSQL 仓储边界测试和事务一致性问题。
- 规划 Redis/共享存储限流适配，明确当前单实例限流到多实例部署的迁移方式。
- 若新增功能或改变契约，同步更新 `backend_ai_docs/openapi.json`、相关设计文档、`docs/STATUS.md` 和 `docs/HANDOFF.md`。
- 如果继续扩展应用级能力，优先沿用 `src/modules/app/` 的 route/service/repository 分层。
- 若继续前端联调：确认前端上传的 `aes-256-cbc-hmac-sha256` 备份快照可通过 `/api/v1/backups/create` 入库；服务端只校验枚举和元数据，不解密密文正文。

## 最近验证
- `npm test`：通过，包含 `tsc --noEmit` 和 13 个默认集成测试。
- `npm run lint`：通过。
- 未运行 `npm run test:postgres`：需要独立 PostgreSQL 测试库和显式环境变量。

## 已知问题
- `npm run test:postgres` 不随默认测试自动执行，需要显式测试库和环境变量。
- 当前限流主要是进程内固定窗口实现，多实例部署需要替换为共享限流存储。
- 部分 PostgreSQL 列表查询仍存在全量查询后内存切页的生产化优化空间。
- 新增 PostgreSQL enum 迁移后，部署到已有数据库时需先执行 `npm run db:migrate`。
