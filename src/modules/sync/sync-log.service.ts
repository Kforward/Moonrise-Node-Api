import { requireActiveSession } from "../auth/auth.service";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import {
  memoryStore,
  type SyncChangeLogRecord,
  type SyncEntityType,
  type SyncOperation,
} from "../../infrastructure/database/memory-store";
import type { ListSyncChangesQuery } from "./sync.dto";

/**
 * 同步变更日志写入参数。
 *
 * 业务写接口通过该结构描述被修改的实体，当前内存实现会生成递增同步版本和校验摘要。
 */
export interface AppendSyncChangeInput {
  userId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  entityVersion?: number | null;
  clientMutationId?: string | null;
}

/**
 * 写入同步变更日志。
 *
 * 所有影响前端跨设备同步的结构化实体写入，都应通过该函数生成同步日志。
 *
 * @param input 同步变更输入。
 */
export function appendSyncChange(input: AppendSyncChangeInput): SyncChangeLogRecord {
  const createdAt = nowIso();
  const syncChange: SyncChangeLogRecord = {
    checksum: buildChangeChecksum(input, createdAt),
    clientMutationId: input.clientMutationId ?? null,
    createdAt,
    entityId: input.entityId,
    entityType: input.entityType,
    entityVersion: input.entityVersion ?? null,
    id: memoryStore.nextSyncChangeId,
    operation: input.operation,
    userId: input.userId,
  };

  memoryStore.nextSyncChangeId += 1;
  memoryStore.syncChangeLogs.push(syncChange);

  return syncChange;
}

/**
 * 拉取当前用户的增量同步变更。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 增量查询参数。
 */
export async function listSyncChanges(currentSession: CurrentSession, query: ListSyncChangesQuery) {
  const session = await requireActiveSession(currentSession);
  const items = memoryStore.syncChangeLogs
    .filter(change => change.userId === session.user.id && change.id > query.afterVersion)
    .sort((left, right) => left.id - right.id)
    .slice(0, query.limit);

  return {
    items,
    nextVersion: items.at(-1)?.id ?? query.afterVersion,
  };
}

/**
 * 获取当前用户同步水位。
 *
 * @param currentSession 当前用户与设备会话。
 */
export async function getSyncState(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const latestChange = [...memoryStore.syncChangeLogs]
    .filter(change => change.userId === session.user.id)
    .sort((left, right) => right.id - left.id)[0];

  return {
    latestVersion: latestChange?.id ?? 0,
  };
}

/**
 * 构造同步变更校验摘要。
 *
 * @param input 同步变更输入。
 * @param createdAt 变更创建时间。
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
