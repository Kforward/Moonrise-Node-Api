import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getDatabaseConfig } from "../config/database.config";
import * as schema from "./schema";

export type MoonriseDatabase = PostgresJsDatabase<typeof schema>;

let postgresSqlClient: Sql | null = null;
let drizzleDatabase: MoonriseDatabase | null = null;

/**
 * 获取 PostgreSQL 原始客户端。
 *
 * 当前阶段只在健康检查和后续仓储迁移中使用；连接池采用懒加载，避免默认内存模式下
 * 启动服务时强制要求本地必须存在 PostgreSQL。
 *
 * @returns postgres.js 客户端。
 * @throws 当 `DATABASE_URL` 未配置时抛出错误。
 */
export function getPostgresClient(): Sql {
  const databaseConfig = getDatabaseConfig();

  if (!databaseConfig.url) {
    throw new Error("DATABASE_URL 未配置，无法创建 PostgreSQL 连接");
  }

  if (!postgresSqlClient) {
    postgresSqlClient = postgres(databaseConfig.url, {
      connect_timeout: 3,
      max: 10,
      prepare: false,
      ssl: databaseConfig.ssl,
    });
  }

  return postgresSqlClient;
}

/**
 * 获取 Drizzle 数据库实例。
 *
 * 业务仓储后续会通过该入口访问 PostgreSQL schema；不要在 service 中直接创建连接，
 * 否则会绕开统一连接池和配置。
 *
 * @returns 绑定 Moonrise schema 的 Drizzle 数据库实例。
 */
export function getDatabase(): MoonriseDatabase {
  if (!drizzleDatabase) {
    drizzleDatabase = drizzle(getPostgresClient(), {
      schema,
    });
  }

  return drizzleDatabase;
}

/**
 * 检查 PostgreSQL 是否可连接。
 *
 * 健康检查只执行轻量 `select 1`，不读取任何业务表，避免探活造成敏感数据访问。
 *
 * @returns 数据库探活结果。
 */
export async function checkPostgresConnection(): Promise<{ connected: boolean; errorMessage: string | null }> {
  try {
    await getPostgresClient()`select 1`;

    return {
      connected: true,
      errorMessage: null,
    };
  } catch (error) {
    return {
      connected: false,
      errorMessage: error instanceof Error ? error.message : "数据库连接检查失败",
    };
  }
}

/**
 * 关闭 PostgreSQL 连接池。
 *
 * 该函数主要给测试和进程优雅退出预留，避免后续集成测试因为连接未关闭而挂起。
 */
export async function closePostgresConnection(): Promise<void> {
  if (postgresSqlClient) {
    await postgresSqlClient.end();
    postgresSqlClient = null;
    drizzleDatabase = null;
  }
}
