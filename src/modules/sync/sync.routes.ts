import type { FastifyInstance } from "fastify";
import { createNotImplementedHandler } from "../../common/handlers/not-implemented-handler";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { listSyncChangesQuerySchema } from "./sync.dto";
import { getSyncState, listSyncChanges } from "./sync-log.service";

/**
 * 注册同步模块路由。
 *
 * 当前阶段先支持拉取同步日志和读取同步水位，批量离线推送后续再落地。
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

  app.post(`${basePath}/push`, createNotImplementedHandler(
    "sync",
    "批量处理离线变更并逐条校验 clientMutationId",
  ));

  app.get(`${basePath}/state`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getSyncState(currentSession));
  });
}
