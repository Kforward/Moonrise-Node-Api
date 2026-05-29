import type { FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface FixedWindowRateLimitOptions {
  keyGenerator?: (request: FastifyRequest) => string;
  max: number;
  namespace: string;
  windowMs: number;
}

/**
 * 创建固定窗口限流 Hook。
 *
 * 该实现优先服务登录、刷新 token 和备份创建等安全敏感接口；当前使用进程内计数，
 * 后续多实例部署时可在不改业务路由的前提下替换为 Redis 适配器。
 *
 * @param options 限流命名空间、窗口长度、最大请求数和可选的限流键生成器。
 * @returns 可直接挂载到 Fastify 路由 `preHandler` 的异步 Hook。
 */
export function createFixedWindowRateLimitPreHandler(options: FixedWindowRateLimitOptions) {
  if (options.max < 1) {
    throw new Error("rate limit max must be greater than 0");
  }

  if (options.windowMs < 1) {
    throw new Error("rate limit windowMs must be greater than 0");
  }

  const buckets = new Map<string, RateLimitBucket>();
  const keyGenerator = options.keyGenerator ?? buildIpRateLimitKey;

  return async (request: FastifyRequest): Promise<void> => {
    const now = Date.now();
    const key = `${options.namespace}:${keyGenerator(request)}`;
    const currentBucket = buckets.get(key);
    const bucket = currentBucket && currentBucket.resetAt > now
      ? currentBucket
      : {
        count: 0,
        resetAt: now + options.windowMs,
      };

    buckets.set(key, bucket);

    if (bucket.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      throw new AppError({
        code: ERROR_CODES.RATE_LIMITED,
        data: {
          retryAfterSeconds,
        },
        message: "请求过于频繁，请稍后再试",
        statusCode: 429,
      });
    }

    bucket.count += 1;
  };
}

/**
 * 生成基于来源 IP 的限流键。
 *
 * 反向代理场景优先读取 `x-forwarded-for` 的首个地址；本地测试和直连请求则退回
 * Fastify 解析出的 `request.ip`。
 *
 * @param request Fastify 请求对象。
 */
export function buildIpRateLimitKey(request: FastifyRequest): string {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return `ip:${forwardedFor.split(",")[0]?.trim() ?? request.ip}`;
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return `ip:${forwardedFor[0].split(",")[0]?.trim() ?? request.ip}`;
  }

  return `ip:${request.ip}`;
}
