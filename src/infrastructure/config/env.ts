import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const optionalNonEmptyString = z.preprocess(
  value => value === "" ? undefined : value,
  z.string().min(1).optional(),
);

const envSchema = z.object({
  API_PREFIX: z.string().default("/api/v1"),
  APP_HOST: z.string().default("0.0.0.0"),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  CORS_ORIGIN: z.string().default("*"),
  DATABASE_DRIVER: z.enum(["memory", "postgresql"]).default("memory"),
  DATABASE_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  WECHAT_LOGIN_MODE: z.enum(["mock", "code2session"]).optional(),
  WECHAT_MINIPROGRAM_APP_ID: optionalNonEmptyString,
  WECHAT_MINIPROGRAM_APP_SECRET: optionalNonEmptyString,
}).superRefine((env, context) => {
  const hasWechatCredentials = Boolean(env.WECHAT_MINIPROGRAM_APP_ID && env.WECHAT_MINIPROGRAM_APP_SECRET);
  const resolvedWechatLoginMode = env.WECHAT_LOGIN_MODE ?? (hasWechatCredentials ? "code2session" : "mock");

  if (resolvedWechatLoginMode === "code2session" && !hasWechatCredentials) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "WECHAT_LOGIN_MODE=code2session 时必须配置 WECHAT_MINIPROGRAM_APP_ID 和 WECHAT_MINIPROGRAM_APP_SECRET",
      path: ["WECHAT_MINIPROGRAM_APP_ID"],
    });
  }

  if (env.NODE_ENV === "production" && resolvedWechatLoginMode !== "code2session") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "生产环境必须使用 WECHAT_LOGIN_MODE=code2session",
      path: ["WECHAT_LOGIN_MODE"],
    });
  }
});

export type CorsOrigin = boolean | string | string[];

/**
 * 解析跨域来源配置。
 *
 * `*` 使用 Fastify CORS 的反射模式，多个域名用英文逗号分隔，便于前端在本地、
 * 测试和生产环境分别配置。
 *
 * @param rawOrigin 从环境变量读取的 CORS 配置。
 */
function parseCorsOrigin(rawOrigin: string): CorsOrigin {
  if (rawOrigin === "*") {
    return true;
  }

  const origins = rawOrigin
    .split(",")
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  return origins.length > 1 ? origins : rawOrigin;
}

const parsedEnv = envSchema.parse(process.env);
const hasWechatCredentials = Boolean(parsedEnv.WECHAT_MINIPROGRAM_APP_ID && parsedEnv.WECHAT_MINIPROGRAM_APP_SECRET);
const wechatLoginMode = parsedEnv.WECHAT_LOGIN_MODE ?? (hasWechatCredentials ? "code2session" : "mock");

export const appEnv = Object.freeze({
  apiPrefix: parsedEnv.API_PREFIX,
  corsOrigin: parseCorsOrigin(parsedEnv.CORS_ORIGIN),
  databaseDriver: parsedEnv.DATABASE_DRIVER,
  databaseUrl: parsedEnv.DATABASE_URL ?? null,
  host: parsedEnv.APP_HOST,
  jwtAccessSecret: parsedEnv.JWT_ACCESS_SECRET ?? null,
  jwtRefreshSecret: parsedEnv.JWT_REFRESH_SECRET ?? null,
  logLevel: parsedEnv.LOG_LEVEL,
  nodeEnv: parsedEnv.NODE_ENV,
  port: parsedEnv.APP_PORT,
  wechatLoginMode,
  wechatMiniProgramAppId: parsedEnv.WECHAT_MINIPROGRAM_APP_ID ?? null,
  wechatMiniProgramAppSecret: parsedEnv.WECHAT_MINIPROGRAM_APP_SECRET ?? null,
});
