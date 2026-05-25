import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import type { SyncChangeLogRecord, SyncEntityType, SyncOperation } from "../../infrastructure/database/memory-store";
import { requireActiveSession } from "../auth/auth.service";
import type { ListSyncChangesQuery } from "./sync.dto";
import { getSyncRepository } from "./sync.repository";

/**
 * 同步变更日志写入参数。
 *
 * 业务写接口通过该结构描述被修改的实体，当前内存实现会生成递增同步版本和校验摘要。
 */
export interface AppendSyncChangeInput {
  /** 变更所属用户 ID。 */
  userId: string;
  /** 被修改的实体类型。 */
  entityType: SyncEntityType;
  /** 被修改的实体 ID。 */
  entityId: string;
  /** 本次同步变更的操作类型。 */
  operation: SyncOperation;
  /** 实体自身版本；当前无实体级版本时允许为空。 */
  entityVersion?: number | null;
  /** 前端生成的幂等变更 ID，用于排查和后续去重。 */
  clientMutationId?: string | null;
}

/**
 * 写入同步变更日志。
 *
 * 所有影响前端跨设备同步的结构化实体写入，都应通过该函数生成同步日志。
 *
 * @param input 同步变更输入。
 * @returns 已写入的同步变更日志。
 */
export async function appendSyncChange(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  const createdAt = nowIso();
  const syncRepository = getSyncRepository();

  return syncRepository.appendChange({
    checksum: buildChangeChecksum(input, createdAt),
    clientMutationId: input.clientMutationId ?? null,
    createdAt,
    entityId: input.entityId,
    entityType: input.entityType,
    entityVersion: input.entityVersion ?? null,
    operation: input.operation,
    userId: input.userId,
  });
}

/**
 * 写入同步变更日志。
 *
 * PostgreSQL 模式写入 `sync_change_logs`，内存模式保留现有数组实现。该函数用于已经
 * 迁移到异步 repository 的业务写操作。
 *
 * @param input 同步变更输入。
 * @returns 已写入的同步变更日志。
 */
export async function appendSyncChangeAsync(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  return appendSyncChange(input);
}

/**
 * 拉取当前用户的增量同步变更。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 增量查询参数。
 * @returns 增量同步变更列表和下一次拉取游标。
 */
export async function listSyncChanges(currentSession: CurrentSession, query: ListSyncChangesQuery) {
  const session = await requireActiveSession(currentSession);

  return getSyncRepository().listChanges(session.user.id, query);
}

/**
 * 获取当前用户同步水位。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户最新同步版本号。
 */
export async function getSyncState(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const latestVersion = await getSyncRepository().getLatestVersion(session.user.id);

  return {
    latestVersion,
  };
}

/**
 * 构造同步变更校验摘要。
 *
 * @param input 同步变更输入。
 * @param createdAt 变更创建时间。
 * @returns 用于同步日志完整性校验的 SHA-256 摘要。
 */
function buildChangeChecksum(input: AppendSyncChangeInput, createdAt: string): string {
  return sha256([
    input.userId,
    input.entityType,
    input.entityId,
    input.operation,
    input.entityVersion ?? "none",
    input.clientMutationId ?? "none",
    createdAt,
  ].join(":"));
}
