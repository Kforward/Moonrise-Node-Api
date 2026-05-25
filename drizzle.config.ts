import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit 本地兜底连接串。
 *
 * 该值只用于本地执行 `db:generate / db:migrate` 时缺少 `.env` 的情况，生产环境必须
 * 显式提供 `DATABASE_URL`，业务运行时不会从这里读取数据库配置。
 */
const fallbackDatabaseUrl = "postgresql://moonrise:moonrise_password@localhost:5432/moonrise";

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
  },
  dialect: "postgresql",
  out: "./src/database/migrations",
  schema: "./src/infrastructure/database/schema.ts",
});
