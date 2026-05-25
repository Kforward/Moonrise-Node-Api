import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import {
  backupSnapshotDetailQuerySchema,
  createBackupSnapshotSchema,
  deleteBackupSnapshotSchema,
  listBackupSnapshotsQuerySchema,
  restoreBackupSnapshotSchema,
} from "./backup.dto";
import {
  createBackupSnapshot,
  deleteBackupSnapshot,
  getBackupSnapshotDetail,
  listBackupSnapshots,
  restoreBackupSnapshot,
} from "./backup.service";

/**
 * 注册备份模块路由。
 *
 * 该模块负责云端密文快照、历史快照列表、恢复审计和快照软删除。
 *
 * @param app Fastify 应用实例。
 */
export async function registerBackupRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/backups`;

  app.get(basePath, async request => {
    const currentSession = requireCurrentSession(request);
    const query = validateWithZod(listBackupSnapshotsQuerySchema, request.query);

    return buildSuccessResponse(request.id, await listBackupSnapshots(currentSession, query));
  });

  app.post(`${basePath}/create`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(createBackupSnapshotSchema, request.body);

    return buildSuccessResponse(request.id, await createBackupSnapshot(currentSession, input));
  });

  app.get(`${basePath}/detail`, async request => {
    const currentSession = requireCurrentSession(request);
    const query = validateWithZod(backupSnapshotDetailQuerySchema, request.query);

    return buildSuccessResponse(request.id, await getBackupSnapshotDetail(currentSession, query));
  });

  app.post(`${basePath}/restore`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(restoreBackupSnapshotSchema, request.body);

    return buildSuccessResponse(request.id, await restoreBackupSnapshot(currentSession, input));
  });

  app.post(`${basePath}/delete`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(deleteBackupSnapshotSchema, request.body);

    return buildSuccessResponse(request.id, await deleteBackupSnapshot(currentSession, input));
  });
}
