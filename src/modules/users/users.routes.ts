import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { getCurrentUserProfile, listCurrentUserDevices, revokeUserDevice, updateCurrentUserProfile } from "./users.service";
import { revokeDeviceSchema, updateUserProfileSchema } from "./users.dto";

/**
 * 注册用户资料模块路由。
 *
 * 该模块负责用户资料、密文联系方式和设备列表等前端所需数据。
 *
 * @param app Fastify 应用实例。
 */
export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/users`;

  app.get(`${basePath}/me`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getCurrentUserProfile(currentSession));
  });

  app.post(`${basePath}/me/update`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(updateUserProfileSchema, request.body);

    return buildSuccessResponse(request.id, await updateCurrentUserProfile(currentSession, input));
  });

  app.get(`${basePath}/me/devices`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await listCurrentUserDevices(currentSession));
  });

  app.post(`${basePath}/me/devices/revoke`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(revokeDeviceSchema, request.body);

    return buildSuccessResponse(request.id, await revokeUserDevice(currentSession, input));
  });
}
