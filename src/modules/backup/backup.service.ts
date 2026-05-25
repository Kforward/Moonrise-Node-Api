import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import type { BackupSnapshotRecord } from "../../infrastructure/database/memory-store";
import { appendAuditLog } from "../audit/audit.service";
import { requireActiveSession } from "../auth/auth.service";
import { replayOrRunMutationAsync } from "../sync/idempotency.service";
import { appendSyncChangeAsync } from "../sync/sync-log.service";
import type {
  BackupSnapshotDetailQuery,
  CreateBackupSnapshotInput,
  DeleteBackupSnapshotInput,
  ListBackupSnapshotsQuery,
  RestoreBackupSnapshotInput,
} from "./backup.dto";
import { getBackupRepository } from "./backup.repository";

const BACKUP_RETENTION_COUNT = 5;

interface PublicBackupSnapshot {
  id: string;
  clientBackupId: string;
  encrypted: boolean;
  algorithm: BackupSnapshotRecord["algorithm"];
  keyVersion: number;
  sizeBytes: number;
  snapshotHash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分页列出当前用户的云端备份快照。
 *
 * 列表只返回快照元数据，不返回密文正文，避免前端列表页无意拉取大体积敏感数据。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 分页查询参数。
 * @returns 当前页备份快照元数据和下一页游标。
 */
export async function listBackupSnapshots(currentSession: CurrentSession, query: ListBackupSnapshotsQuery) {
  const session = await requireActiveSession(currentSession);
  const page = await getBackupRepository().listSnapshots(session.user.id, query);

  return {
    items: page.items.map(toPublicBackupSnapshot),
    nextCursor: page.nextCursor,
  };
}

/**
 * 获取备份快照密文详情。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 快照详情查询参数。
 * @returns 备份快照元数据和密文正文。
 */
export async function getBackupSnapshotDetail(currentSession: CurrentSession, query: BackupSnapshotDetailQuery) {
  const session = await requireActiveSession(currentSession);
  const snapshot = await requireOwnedActiveBackupSnapshot(session.user.id, query.id);

  return {
    snapshot: {
      ...toPublicBackupSnapshot(snapshot),
      snapshotCiphertext: snapshot.snapshotCiphertext,
    },
  };
}

/**
 * 创建云端备份快照。
 *
 * 保存前会校验同一客户端备份 ID 是否已存在有效快照；保存后会写入审计日志、同步日志，
 * 并按当前策略保留最近 5 条有效快照。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 创建备份快照请求 DTO。
 * @returns 已创建的备份快照元数据。
 */
export async function createBackupSnapshot(currentSession: CurrentSession, input: CreateBackupSnapshotInput) {
  const session = await requireActiveSession(currentSession);
  const backupRepository = getBackupRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const existingSnapshot = await backupRepository.findSnapshotByClientBackupId(
      session.user.id,
      input.payload.clientBackupId,
    );

    if (existingSnapshot) {
      throw new AppError({
        code: ERROR_CODES.BACKUP_SNAPSHOT_CONFLICT,
        data: {
          snapshotId: existingSnapshot.id,
        },
        message: "该客户端备份 ID 已存在",
        statusCode: 409,
      });
    }

    const timestamp = nowIso();
    const snapshot = await backupRepository.createSnapshot({
      algorithm: input.payload.algorithm,
      clientBackupId: input.payload.clientBackupId,
      createdAt: timestamp,
      encrypted: input.payload.encrypted,
      id: randomUUID(),
      keyVersion: input.payload.keyVersion,
      sizeBytes: input.payload.sizeBytes,
      snapshotCiphertext: input.payload.snapshotCiphertext,
      snapshotHash: input.payload.snapshotHash,
      updatedAt: timestamp,
      userId: session.user.id,
    });

    await appendAuditLog({
      action: "backup_snapshot.create",
      deviceId: session.device.id,
      metadata: {
        algorithm: snapshot.algorithm,
        encrypted: snapshot.encrypted,
        sizeBytes: snapshot.sizeBytes,
      },
      resourceId: snapshot.id,
      resourceType: "backup_snapshot",
      userId: session.user.id,
    });
    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: snapshot.id,
      entityType: "backup_snapshot",
      operation: "create",
      userId: session.user.id,
    });
    await pruneOldBackupSnapshots(session.user.id, session.device.id, snapshot.id);

    return {
      snapshot: toPublicBackupSnapshot(snapshot),
    };
  });
}

/**
 * 标记一次备份恢复操作。
 *
 * 恢复动作不直接改写结构化业务表，只记录审计和同步日志，让前端可以基于快照密文完成
 * 用户确认后的本地恢复流程。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 恢复备份快照请求 DTO。
 * @returns 被恢复的备份快照元数据。
 */
export async function restoreBackupSnapshot(currentSession: CurrentSession, input: RestoreBackupSnapshotInput) {
  const session = await requireActiveSession(currentSession);

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const snapshot = await requireOwnedActiveBackupSnapshot(session.user.id, input.payload.id);

    await appendAuditLog({
      action: "backup_snapshot.restore",
      deviceId: session.device.id,
      metadata: {
        snapshotHash: snapshot.snapshotHash,
      },
      resourceId: snapshot.id,
      resourceType: "backup_snapshot",
      userId: session.user.id,
    });
    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: snapshot.id,
      entityType: "backup_snapshot",
      operation: "restore",
      userId: session.user.id,
    });

    return {
      restoredAt: nowIso(),
      snapshot: toPublicBackupSnapshot(snapshot),
    };
  });
}

/**
 * 软删除备份快照。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 删除备份快照请求 DTO。
 * @returns 被删除快照 ID 和删除时间。
 */
export async function deleteBackupSnapshot(currentSession: CurrentSession, input: DeleteBackupSnapshotInput) {
  const session = await requireActiveSession(currentSession);
  const backupRepository = getBackupRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const deletedAt = nowIso();
    const snapshot = await backupRepository.softDeleteSnapshot(session.user.id, input.payload.id, deletedAt);

    if (!snapshot) {
      throwBackupSnapshotNotFound();
    }

    await appendAuditLog({
      action: "backup_snapshot.delete",
      deviceId: session.device.id,
      resourceId: snapshot.id,
      resourceType: "backup_snapshot",
      userId: session.user.id,
    });
    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: snapshot.id,
      entityType: "backup_snapshot",
      operation: "delete",
      userId: session.user.id,
    });

    return {
      deletedAt: snapshot.deletedAt,
      snapshotId: snapshot.id,
    };
  });
}

/**
 * 按保留策略软删除较早的备份快照。
 *
 * @param userId 用户 ID。
 * @param deviceId 当前设备 ID。
 * @param latestSnapshotId 本次新创建的快照 ID。
 */
async function pruneOldBackupSnapshots(userId: string, deviceId: string, latestSnapshotId: string): Promise<void> {
  const deletedAt = nowIso();
  const deletedSnapshots = await getBackupRepository().pruneSnapshots(userId, BACKUP_RETENTION_COUNT, deletedAt);

  for (const deletedSnapshot of deletedSnapshots) {
    if (deletedSnapshot.id === latestSnapshotId) {
      continue;
    }

    await appendAuditLog({
      action: "backup_snapshot.prune",
      deviceId,
      metadata: {
        reason: "retention_limit",
      },
      resourceId: deletedSnapshot.id,
      resourceType: "backup_snapshot",
      userId,
    });
    await appendSyncChangeAsync({
      clientMutationId: null,
      entityId: deletedSnapshot.id,
      entityType: "backup_snapshot",
      operation: "delete",
      userId,
    });
  }
}

/**
 * 查找当前用户拥有的有效备份快照。
 *
 * @param userId 用户 ID。
 * @param snapshotId 备份快照 ID。
 * @returns 当前用户拥有的有效备份快照。
 */
async function requireOwnedActiveBackupSnapshot(userId: string, snapshotId: string): Promise<BackupSnapshotRecord> {
  const snapshot = await getBackupRepository().findActiveSnapshot(userId, snapshotId);

  if (!snapshot) {
    throwBackupSnapshotNotFound();
  }

  return snapshot;
}

/**
 * 转换为前端可见的备份快照元数据。
 *
 * @param snapshot 备份快照记录。
 * @returns 不包含密文正文的公开快照元数据。
 */
function toPublicBackupSnapshot(snapshot: BackupSnapshotRecord): PublicBackupSnapshot {
  return {
    algorithm: snapshot.algorithm,
    clientBackupId: snapshot.clientBackupId,
    createdAt: snapshot.createdAt,
    encrypted: snapshot.encrypted,
    id: snapshot.id,
    keyVersion: snapshot.keyVersion,
    sizeBytes: snapshot.sizeBytes,
    snapshotHash: snapshot.snapshotHash,
    updatedAt: snapshot.updatedAt,
  };
}

/**
 * 抛出备份快照不存在错误。
 */
function throwBackupSnapshotNotFound(): never {
  throw new AppError({
    code: ERROR_CODES.BACKUP_SNAPSHOT_NOT_FOUND,
    message: "备份快照不存在或已删除",
    statusCode: 404,
  });
}
