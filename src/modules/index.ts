import type { FastifyInstance } from "fastify";
import { registerAppRoutes } from "./app/app.routes";
import { registerAuditRoutes } from "./audit/audit.routes";
import { registerAuthRoutes } from "./auth/auth.routes";
import { registerBackupRoutes } from "./backup/backup.routes";
import { registerCycleRoutes } from "./cycle/cycle.routes";
import { registerHealthRoutes } from "./health/health.routes";
import { registerPrivacyRoutes } from "./privacy/privacy.routes";
import { registerSyncRoutes } from "./sync/sync.routes";
import { registerUsersRoutes } from "./users/users.routes";

/**
 * 注册所有业务模块路由。
 *
 * 这里是模块接入的唯一入口，后续新增模块时应先在此登记，避免业务路由散落在
 * 应用启动文件中。
 *
 * @param app Fastify 应用实例。
 */
export async function registerModules(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerAppRoutes(app);
  await registerAuthRoutes(app);
  await registerUsersRoutes(app);
  await registerCycleRoutes(app);
  await registerBackupRoutes(app);
  await registerPrivacyRoutes(app);
  await registerSyncRoutes(app);
  await registerAuditRoutes(app);
}
