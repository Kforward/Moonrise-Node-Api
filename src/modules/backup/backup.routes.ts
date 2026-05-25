import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册备份模块路由骨架。
 *
 * 后续该模块负责云端密文快照、历史快照列表、恢复审计和快照软删除。
 *
 * @param app Fastify 应用实例。
 */
export async function registerBackupRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/backups`;

  await registerPlaceholderRoutes(app, "backup", [
    {
      method: "GET",
      nextStep: "游标分页读取 backup_snapshots 元数据",
      path: basePath,
    },
    {
      method: "POST",
      nextStep: "保存加密快照并保留最近 N 次备份",
      path: `${basePath}/create`,
    },
    {
      method: "GET",
      nextStep: "按快照 ID 读取密文详情并校验资源归属",
      path: `${basePath}/detail`,
    },
    {
      method: "POST",
      nextStep: "记录恢复来源快照并写入 audit_logs",
      path: `${basePath}/restore`,
    },
    {
      method: "POST",
      nextStep: "软删除备份快照并写入审计日志",
      path: `${basePath}/delete`,
    },
  ]);
}
