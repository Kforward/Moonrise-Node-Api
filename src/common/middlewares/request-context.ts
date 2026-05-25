import type { FastifyInstance } from "fastify";

/**
 * 注册请求上下文相关 Hook。
 *
 * 当前阶段先把请求 ID 写入响应头，后续可以在这里继续接入访问日志、当前用户、
 * 当前设备、幂等键解析等横切能力。
 *
 * @param app Fastify 应用实例。
 */
export function registerRequestContextHooks(app: FastifyInstance): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
}
