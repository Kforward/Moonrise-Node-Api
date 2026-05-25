import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { listSyncChangesQuerySchema, syncPushSchema } from "./sync.dto";
import { getSyncState, listSyncChanges, pushSyncChanges } from "./sync-log.service";

/**
 * 注册同步模块路由。
 *
 * 当前阶段支持拉取同步日志、读取同步水位和批量提交已支持的离线变更。
 *
 * @param app Fastify 应用实例。
 */
export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/sync`;

  app.get(`${basePath}/changes`, async request => {
    const currentSession = requireCurrentSession(request);
    const query = validateWithZod(listSyncChangesQuerySchema, request.query);

    return buildSuccessResponse(request.id, await listSyncChanges(currentSession, query));
  });

  app.post(`${basePath}/push`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(syncPushSchema, request.body);

    return buildSuccessResponse(request.id, await pushSyncChanges(currentSession, input));
  });

  app.get(`${basePath}/state`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getSyncState(currentSession));
  });
}
