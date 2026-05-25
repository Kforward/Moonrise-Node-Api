import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { SyncChangeLogRecord } from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { syncChangeLogs } from "../../infrastructure/database/schema";
import type { AppendSyncChangeData, ListSyncChangesOptions, SyncChangesPage, SyncRepository } from "./sync.repository";

type SyncChangeLogRow = typeof syncChangeLogs.$inferSelect;

/**
 * PostgreSQL 版同步仓储。
 *
 * 该实现承接 `sync_change_logs` 的持久化读写，为前端跨设备增量同步提供稳定版本游标。
 */
export const postgresSyncRepository: SyncRepository = {
  /**
   * 写入 PostgreSQL 同步变更日志。
   *
   * @param data 已补齐 checksum 和创建时间的同步变更数据。
   * @returns 已写入的同步变更日志。
   */
  async appendChange(data: AppendSyncChangeData): Promise<SyncChangeLogRecord> {
    const [syncChange] = await getDatabase().insert(syncChangeLogs).values({
      checksum: data.checksum,
      clientMutationId: data.clientMutationId,
      createdAt: data.createdAt,
      entityId: data.entityId,
      entityType: data.entityType,
      entityVersion: data.entityVersion,
      operation: data.operation,
      userId: data.userId,
    }).returning();

    return toSyncChangeLogRecord(assertRow(syncChange, "写入同步变更日志失败"));
  },

  /**
   * 从 PostgreSQL 拉取用户增量同步变更。
   *
   * @param userId 用户 ID。
   * @param options 增量查询参数。
   * @returns 当前页变更列表和下一次拉取游标。
   */
  async listChanges(userId: string, options: ListSyncChangesOptions): Promise<SyncChangesPage> {
    const items = await getDatabase()
      .select()
      .from(syncChangeLogs)
      .where(and(
        eq(syncChangeLogs.userId, userId),
        gt(syncChangeLogs.id, options.afterVersion),
      ))
      .orderBy(asc(syncChangeLogs.id))
      .limit(options.limit);
    const mappedItems = items.map(toSyncChangeLogRecord);

    return {
      items: mappedItems,
      nextVersion: mappedItems.at(-1)?.id ?? options.afterVersion,
    };
  },

  /**
   * 获取 PostgreSQL 同步日志中的最新版本号。
   *
   * @param userId 用户 ID。
   * @returns 当前用户最新同步版本号。
   */
  async getLatestVersion(userId: string): Promise<number> {
    const [latestChange] = await getDatabase()
      .select()
      .from(syncChangeLogs)
      .where(eq(syncChangeLogs.userId, userId))
      .orderBy(desc(syncChangeLogs.id))
      .limit(1);

    return latestChange?.id ?? 0;
  },
};

/**
 * 确认数据库写入返回了记录。
 *
 * @param row Drizzle returning 返回的首条记录。
 * @param message 写入失败时用于内部排查的错误消息。
 * @returns 非空数据库记录。
 */
function assertRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) {
    throw new Error(message);
  }

  return row;
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
