import { appEnv } from "./env";

export interface DatabaseConfig {
  driver: "memory" | "postgresql";
  provider: "postgresql";
  url: string | null;
  ssl: boolean;
}

/**
 * 获取数据库连接配置。
 *
 * `memory` 是当前默认开发适配器，`postgresql` 会在业务仓储切换时启用 Drizzle
 * 连接池。配置集中在这里，避免业务模块直接读取环境变量。
 *
 * @returns 数据库运行模式、PostgreSQL 连接串和 SSL 策略。
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    driver: appEnv.databaseDriver,
    provider: "postgresql",
    ssl: appEnv.nodeEnv === "production",
    url: appEnv.databaseUrl,
  };
}
