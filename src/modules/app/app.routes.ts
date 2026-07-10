import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import {
  appReleaseDetailQuerySchema,
  listAppReleasesQuerySchema,
  updateAppPreferencesSchema,
} from "./app.dto";
import {
  getAppReleaseDetail,
  getCurrentAppPreferences,
  listAppReleases,
  updateCurrentAppPreferences,
} from "./app.service";

/**
 * 注册应用级业务路由。
 *
 * 该模块承接不适合放入用户资料、周期或隐私模块的应用元数据和轻量用户偏好。
 *
 * @param app Fastify 应用实例。
 */
export async function registerAppRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/app`;

  app.get(`${basePath}/preferences`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getCurrentAppPreferences(currentSession));
  });

  app.post(`${basePath}/preferences/update`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(updateAppPreferencesSchema, request.body);

    return buildSuccessResponse(request.id, await updateCurrentAppPreferences(currentSession, input));
  });

  app.get(`${basePath}/releases`, async request => {
    const query = validateWithZod(listAppReleasesQuerySchema, request.query);

    return buildSuccessResponse(request.id, await listAppReleases(query));
  });

  app.get(`${basePath}/releases/detail`, async request => {
    const query = validateWithZod(appReleaseDetailQuerySchema, request.query);

    return buildSuccessResponse(request.id, await getAppReleaseDetail(query));
  });
}
