import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册认证模块路由骨架。
 *
 * 第一阶段后续会在这里实现微信小程序登录、token 刷新、设备会话和退出登录。
 *
 * @param app Fastify 应用实例。
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/auth`;

  await registerPlaceholderRoutes(app, "auth", [
    {
      method: "POST",
      nextStep: "接入微信 code 换 openid，并创建 auth_identities 与 user_devices",
      path: `${basePath}/wechat/login`,
    },
    {
      method: "POST",
      nextStep: "校验 refresh token 哈希并签发新的 access token",
      path: `${basePath}/refresh`,
    },
    {
      method: "POST",
      nextStep: "注销当前设备会话并写入审计日志",
      path: `${basePath}/logout`,
    },
    {
      method: "GET",
      nextStep: "解析当前 access token 并返回用户与设备会话状态",
      path: `${basePath}/session`,
    },
  ]);
}
