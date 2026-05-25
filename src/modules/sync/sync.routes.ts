import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册同步模块路由骨架。
 *
 * 后续该模块负责增量变更、离线批量推送、幂等键和同步水位。
 *
 * @param app Fastify 应用实例。
 */
export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/sync`;

  await registerPlaceholderRoutes(app, "sync", [
    {
      method: "GET",
      nextStep: "根据 afterVersion 拉取 sync_change_logs 增量变更",
      path: `${basePath}/changes`,
    },
    {
      method: "POST",
      nextStep: "批量处理离线变更并逐条校验 clientMutationId",
      path: `${basePath}/push`,
    },
    {
      method: "GET",
      nextStep: "返回服务器同步水位和当前用户最新版本",
      path: `${basePath}/state`,
    },
  ]);
}
