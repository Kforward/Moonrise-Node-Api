import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { appEnv } from "../../infrastructure/config/env";
import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import { BACKEND_MODULES } from "../module-catalog";

/**
 * 注册健康检查路由。
 *
 * 健康检查用于前端、部署平台和本地开发确认服务骨架是否正常启动。
 *
 * @param app Fastify 应用实例。
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get(`${appEnv.apiPrefix}/health`, async request => buildHealthResponse(request));
}

/**
 * 构造健康检查响应。
 *
 * @param request 当前请求对象，用于取得请求 ID。
 */
function buildHealthResponse(request: FastifyRequest) {
  const databaseConfig = getDatabaseConfig();

  return buildSuccessResponse(request.id, {
    database: {
      configured: databaseConfig.url !== null,
      provider: databaseConfig.provider,
    },
    modules: BACKEND_MODULES,
    service: "moonrise-node-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
