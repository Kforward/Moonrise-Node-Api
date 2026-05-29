import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { createFixedWindowRateLimitPreHandler } from "../../common/middlewares/rate-limit";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { getCurrentSession, loginWithWechat, logoutSession, refreshSession } from "./auth.service";
import { refreshTokenSchema, wechatLoginSchema } from "./auth.dto";

/**
 * 注册认证模块路由。
 *
 * 该模块提供微信登录、token 刷新、当前会话读取和设备退出能力。
 *
 * @param app Fastify 应用实例。
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/auth`;
  const loginRateLimit = createFixedWindowRateLimitPreHandler({
    max: 5,
    namespace: "auth.wechat.login",
    windowMs: 60_000,
  });
  const refreshRateLimit = createFixedWindowRateLimitPreHandler({
    max: 10,
    namespace: "auth.refresh",
    windowMs: 60_000,
  });

  app.post(`${basePath}/wechat/login`, { preHandler: loginRateLimit }, async request => {
    const input = validateWithZod(wechatLoginSchema, request.body);

    return buildSuccessResponse(request.id, await loginWithWechat(input));
  });

  app.post(`${basePath}/refresh`, { preHandler: refreshRateLimit }, async request => {
    const input = validateWithZod(refreshTokenSchema, request.body);

    return buildSuccessResponse(request.id, await refreshSession(input));
  });

  app.post(`${basePath}/logout`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await logoutSession(currentSession));
  });

  app.get(`${basePath}/session`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getCurrentSession(currentSession));
  });
}
