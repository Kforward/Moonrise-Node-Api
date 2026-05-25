import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册用户资料模块路由骨架。
 *
 * 后续该模块负责用户资料、联系方式密文列和设备列表等前端所需数据。
 *
 * @param app Fastify 应用实例。
 */
export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/users`;

  await registerPlaceholderRoutes(app, "users", [
    {
      method: "GET",
      nextStep: "读取 user_profiles、user_app_preferences 和当前用户基础状态",
      path: `${basePath}/me`,
    },
    {
      method: "POST",
      nextStep: "更新昵称、头像、性别、手机号密文和邮箱密文",
      path: `${basePath}/me/update`,
    },
    {
      method: "GET",
      nextStep: "读取 user_devices 并过滤已注销设备",
      path: `${basePath}/me/devices`,
    },
    {
      method: "POST",
      nextStep: "注销用户指定设备并写入审计日志",
      path: `${basePath}/me/devices/revoke`,
    },
  ]);
}
