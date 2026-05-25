import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { getCurrentSession, loginWithWechat, logoutSession, refreshSession } from "./auth.service";
import { refreshTokenSchema, wechatLoginSchema } from "./auth.dto";

/**
 * 注册认证模块路由。
 *
 * 第一阶段先提供开发期微信登录、token 刷新、当前会话读取和设备退出能力。
 *
 * @param app Fastify 应用实例。
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/auth`;

  app.post(`${basePath}/wechat/login`, async request => {
    const input = validateWithZod(wechatLoginSchema, request.body);

    return buildSuccessResponse(request.id, loginWithWechat(input));
  });

  app.post(`${basePath}/refresh`, async request => {
    const input = validateWithZod(refreshTokenSchema, request.body);

    return buildSuccessResponse(request.id, refreshSession(input));
  });

  app.post(`${basePath}/logout`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, logoutSession(currentSession));
  });

  app.get(`${basePath}/session`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, getCurrentSession(currentSession));
  });
}
