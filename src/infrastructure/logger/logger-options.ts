import type { FastifyServerOptions } from "fastify";
import { appEnv } from "../config/env";

/**
 * 生成 Fastify 日志配置。
 *
 * 日志级别统一由环境变量控制，避免业务模块直接读取 process.env。
 */
export function getLoggerOptions(): FastifyServerOptions["logger"] {
  if (appEnv.logLevel === "silent") {
    return false;
  }

  return {
    level: appEnv.logLevel,
  };
}
