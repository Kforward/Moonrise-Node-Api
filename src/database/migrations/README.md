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
