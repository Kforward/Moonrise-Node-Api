import { appEnv } from "./env";

export interface DatabaseConfig {
  provider: "postgresql";
  url: string | null;
  ssl: boolean;
}

/**
 * 获取数据库连接配置。
 *
 * 第一轮只保留 PostgreSQL 配置入口，具体 ORM 和连接池会在数据层落地时接入。
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    provider: "postgresql",
    ssl: appEnv.nodeEnv === "production",
    url: appEnv.databaseUrl,
  };
}
