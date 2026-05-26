import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import { listVaultItemsQuerySchema, saveVaultItemSchema, updatePrivacyConfigSchema } from "./privacy.dto";
import { getPrivacyConfig, listVaultItems, saveVaultItem, updatePrivacyConfig } from "./privacy.service";

/**
 * 注册隐私安全模块路由。
 *
 * 该模块负责隐私配置、加密模式、密钥版本和端到端加密条目托管。
 *
 * @param app Fastify 应用实例。
 */
export async function registerPrivacyRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/privacy`;

  app.get(`${basePath}/config`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getPrivacyConfig(currentSession));
  });

  app.post(`${basePath}/config/update`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(updatePrivacyConfigSchema, request.body);

    return buildSuccessResponse(request.id, await updatePrivacyConfig(currentSession, input));
  });

  app.post(`${basePath}/vault-items/save`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(saveVaultItemSchema, request.body);

    return buildSuccessResponse(request.id, await saveVaultItem(currentSession, input));
  });

  app.get(`${basePath}/vault-items`, async request => {
    const currentSession = requireCurrentSession(request);
    const query = validateWithZod(listVaultItemsQuerySchema, request.query);

    return buildSuccessResponse(request.id, await listVaultItems(currentSession, query));
  });
}
