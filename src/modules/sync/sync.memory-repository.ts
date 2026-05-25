import { memoryStore, type SyncChangeLogRecord } from "../../infrastructure/database/memory-store";
import type { AppendSyncChangeData, ListSyncChangesOptions, SyncChangesPage, SyncRepository } from "./sync.repository";

/**
 * 内存版同步仓储。
 *
 * 该实现保留开发期同步日志数组行为，便于前端本地联调时不依赖 PostgreSQL。
 */
export const memorySyncRepository: SyncRepository = {
  /**
   * 写入内存同步变更日志。
   *
   * @param data 已补齐 checksum 和创建时间的同步变更数据。
   * @returns 已写入的同步变更日志。
   */
  async appendChange(data: AppendSyncChangeData): Promise<SyncChangeLogRecord> {
    const syncChange: SyncChangeLogRecord = {
      checksum: data.checksum,
      clientMutationId: data.clientMutationId,
      createdAt: data.createdAt,
      entityId: data.entityId,
      entityType: data.entityType,
      entityVersion: data.entityVersion,
      id: memoryStore.nextSyncChangeId,
      operation: data.operation,
      userId: data.userId,
    };

    memoryStore.nextSyncChangeId += 1;
    memoryStore.syncChangeLogs.push(syncChange);

    return syncChange;
  },

  /**
   * 从内存同步日志中拉取用户增量变更。
   *
   * @param userId 用户 ID。
   * @param options 增量查询参数。
   * @returns 当前页变更列表和下一次拉取游标。
   */
  async listChanges(userId: string, options: ListSyncChangesOptions): Promise<SyncChangesPage> {
    const items = memoryStore.syncChangeLogs
      .filter(change => change.userId === userId && change.id > options.afterVersion)
      .sort((left, right) => left.id - right.id)
      .slice(0, options.limit);

    return {
      items,
      nextVersion: items.at(-1)?.id ?? options.afterVersion,
    };
  },

  /**
   * 获取内存同步日志中的最新版本号。
   *
   * @param userId 用户 ID。
   * @returns 当前用户最新同步版本号。
   */
  async getLatestVersion(userId: string): Promise<number> {
    const latestChange = [...memoryStore.syncChangeLogs]
      .filter(change => change.userId === userId)
      .sort((left, right) => right.id - left.id)[0];

    return latestChange?.id ?? 0;
  },
};
