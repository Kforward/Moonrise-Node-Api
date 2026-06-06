# 数据库迁移目录

PostgreSQL 迁移文件由 Drizzle Kit 生成，内容应以 `backend_ai_docs/04_database_design.md`
为基准。

常用命令：

```bash
npm run db:generate
npm run db:migrate
```

当前业务接口默认仍使用内存仓储，便于本地联调；当 `DATABASE_DRIVER=postgresql` 且
`DATABASE_URL` 配置完成后，已落地模块会切换到对应 PostgreSQL 仓储实现。

PostgreSQL 仓储集成测试会清空业务表，只能连接独立测试库。建议数据库名称包含 `test`，
例如 `moonrise_test`；完成迁移后再显式运行：

```powershell
$env:RUN_POSTGRES_TESTS="1"
$env:DATABASE_URL="postgresql://moonrise_test_user:moonrise_test_password@localhost:5432/moonrise_test"
npm run test:postgres
```

测试环境和生产环境应使用独立数据库与独立角色，推荐 `moonrise_test` / `moonrise_test_user`
和 `moonrise_prod` / `moonrise_prod_user`。建库与授权模板见
`backend_ai_docs/database/environment_isolation.sql`。
