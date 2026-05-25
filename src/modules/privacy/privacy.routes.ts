import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册隐私安全模块路由骨架。
 *
 * 后续该模块负责隐私配置、加密模式、密钥版本和端到端加密条目托管。
 *
 * @param app Fastify 应用实例。
 */
export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/privacy`;

  await registerPlaceholderRoutes(app, "privacy", [
    {
      method: "GET",
      nextStep: "读取当前用户 privacy_configs",
      path: `${basePath}/config`,
    },
    {
      method: "POST",
      nextStep: "更新加密模式、算法和 key_version，并写审计日志",
      path: `${basePath}/config/update`,
    },
    {
      method: "POST",
      nextStep: "保存端到端加密 vault item，不接触明文",
      path: `${basePath}/vault-items/save`,
    },
    {
      method: "GET",
      nextStep: "拉取当前用户 encrypted_vault_items",
      path: `${basePath}/vault-items`,
    },
  ]);
}
