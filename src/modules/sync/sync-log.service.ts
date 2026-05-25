import { requireActiveSession } from "../auth/auth.service";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { syncChangeLogs } from "../../infrastructure/database/schema";
import {
  memoryStore,
  type SyncChangeLogRecord,
  type SyncEntityType,
  type SyncOperation,
} from "../../infrastructure/database/memory-store";
import type { ListSyncChangesQuery } from "./sync.dto";

type SyncChangeLogRow = typeof syncChangeLogs.$inferSelect;

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
 * @returns 已写入内存存储的同步变更日志。
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
 * 写入同步变更日志。
 *
 * PostgreSQL 模式写入 `sync_change_logs`，内存模式保留现有数组实现。该函数用于已经
 * 迁移到异步 repository 的业务写操作。
 *
 * @param input 同步变更输入。
 * @returns 已写入的同步变更日志。
 */
export async function appendSyncChangeAsync(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  if (getDatabaseConfig().driver === "postgresql") {
    return appendPostgresSyncChange(input);
  }

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

  if (getDatabaseConfig().driver === "postgresql") {
    const items = await getDatabase()
      .select()
      .from(syncChangeLogs)
      .where(and(
        eq(syncChangeLogs.userId, session.user.id),
        gt(syncChangeLogs.id, query.afterVersion),
      ))
      .orderBy(asc(syncChangeLogs.id))
      .limit(query.limit);
    const mappedItems = items.map(toSyncChangeLogRecord);

    return {
      items: mappedItems,
      nextVersion: mappedItems.at(-1)?.id ?? query.afterVersion,
    };
  }

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
 * @returns 当前用户最新同步版本号。
 */
export async function getSyncState(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);

  if (getDatabaseConfig().driver === "postgresql") {
    const [latestChange] = await getDatabase()
      .select()
      .from(syncChangeLogs)
      .where(eq(syncChangeLogs.userId, session.user.id))
      .orderBy(desc(syncChangeLogs.id))
      .limit(1);

    return {
      latestVersion: latestChange?.id ?? 0,
    };
  }

  const latestChange = [...memoryStore.syncChangeLogs]
    .filter(change => change.userId === session.user.id)
    .sort((left, right) => right.id - left.id)[0];

  return {
    latestVersion: latestChange?.id ?? 0,
  };
}

/**
 * 写入 PostgreSQL 同步变更日志。
 *
 * @param input 同步变更输入。
 * @returns 数据库同步变更记录。
 */
async function appendPostgresSyncChange(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  const createdAt = nowIso();
  const [syncChange] = await getDatabase().insert(syncChangeLogs).values({
    checksum: buildChangeChecksum(input, createdAt),
    clientMutationId: input.clientMutationId ?? null,
    createdAt,
    entityId: input.entityId,
    entityType: input.entityType,
    entityVersion: input.entityVersion ?? null,
    operation: input.operation,
    userId: input.userId,
  }).returning();

  if (!syncChange) {
    throw new Error("写入同步变更日志失败");
  }

  return toSyncChangeLogRecord(syncChange);
}

/**
 * 转换数据库同步变更日志记录。
 *
 * @param row Drizzle 同步变更行。
 * @returns service 层使用的同步变更记录。
 */
function toSyncChangeLogRecord(row: SyncChangeLogRow): SyncChangeLogRecord {
  return {
    checksum: row.checksum,
    clientMutationId: row.clientMutationId,
    createdAt: row.createdAt,
    entityId: row.entityId,
    entityType: row.entityType,
    entityVersion: row.entityVersion,
    id: row.id,
    operation: row.operation,
    userId: row.userId,
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
