import {
  memoryStore,
  type BackupSnapshotRecord,
} from "../../infrastructure/database/memory-store";
import type {
  BackupRepository,
  BackupSnapshotsPage,
  CreateBackupSnapshotData,
  ListBackupSnapshotsOptions,
} from "./backup.repository";

/**
 * 内存版备份仓储。
 *
 * 该实现服务开发期和集成测试，行为尽量贴近 PostgreSQL 仓储：只返回未软删除快照，
 * 并按创建时间倒序分页。
 */
export const memoryBackupRepository: BackupRepository = {
  /**
   * 分页列出内存中的有效备份快照。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页快照元数据和下一页游标。
   */
  async listSnapshots(userId: string, options: ListBackupSnapshotsOptions): Promise<BackupSnapshotsPage> {
    const snapshots = listActiveSnapshots(userId);

    return sliceBackupSnapshotsPage(snapshots, options);
  },

  /**
   * 从内存中查找有效备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 备份快照 ID。
   * @returns 有效快照；不存在、已删除或不属于用户时返回 `null`。
   */
  async findActiveSnapshot(userId: string, snapshotId: string): Promise<BackupSnapshotRecord | null> {
    const snapshot = memoryStore.backupSnapshots.get(snapshotId);

    if (!snapshot || snapshot.userId !== userId || snapshot.deletedAt) {
      return null;
    }

    return snapshot;
  },

  /**
   * 按客户端备份 ID 查找内存快照。
   *
   * @param userId 用户 ID。
   * @param clientBackupId 客户端备份 ID。
   * @returns 快照记录；不存在时返回 `null`。
   */
  async findSnapshotByClientBackupId(userId: string, clientBackupId: string): Promise<BackupSnapshotRecord | null> {
    return [...memoryStore.backupSnapshots.values()].find(snapshot =>
      snapshot.userId === userId && snapshot.clientBackupId === clientBackupId
    ) ?? null;
  },

  /**
   * 创建内存备份快照。
   *
   * @param data 已补齐 ID 和时间的快照数据。
   * @returns 已创建的快照记录。
   */
  async createSnapshot(data: CreateBackupSnapshotData): Promise<BackupSnapshotRecord> {
    const snapshot: BackupSnapshotRecord = {
      ...data,
      deletedAt: null,
    };

    memoryStore.backupSnapshots.set(snapshot.id, snapshot);

    return snapshot;
  },

  /**
   * 软删除内存备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 备份快照 ID。
   * @param deletedAt 软删除时间。
   * @returns 删除后的快照；不存在、已删除或不属于用户时返回 `null`。
   */
  async softDeleteSnapshot(userId: string, snapshotId: string, deletedAt: string): Promise<BackupSnapshotRecord | null> {
    const snapshot = await this.findActiveSnapshot(userId, snapshotId);

    if (!snapshot) {
      return null;
    }

    snapshot.deletedAt = deletedAt;
    snapshot.updatedAt = deletedAt;

    return snapshot;
  },

  /**
   * 按保留策略软删除较早的内存备份快照。
   *
   * @param userId 用户 ID。
   * @param keepLatestCount 需要保留的最新有效快照数量。
   * @param deletedAt 软删除时间。
   * @returns 被软删除的快照列表。
   */
  async pruneSnapshots(userId: string, keepLatestCount: number, deletedAt: string): Promise<BackupSnapshotRecord[]> {
    const snapshotsToDelete = listActiveSnapshots(userId).slice(keepLatestCount);

    for (const snapshot of snapshotsToDelete) {
      snapshot.deletedAt = deletedAt;
      snapshot.updatedAt = deletedAt;
    }

    return snapshotsToDelete;
  },
};

/**
 * 列出指定用户有效快照并按创建时间倒序排列。
 *
 * @param userId 用户 ID。
 * @returns 已排序的有效备份快照。
 */
function listActiveSnapshots(userId: string): BackupSnapshotRecord[] {
  return [...memoryStore.backupSnapshots.values()]
    .filter(snapshot => snapshot.userId === userId && !snapshot.deletedAt)
    .sort(sortBackupSnapshotsByCreatedAtDesc);
}

/**
 * 按游标切分备份快照页。
 *
 * @param sortedSnapshots 已按创建时间倒序排列的有效快照。
 * @param options 分页参数。
 * @returns 当前页快照和下一页游标。
 */
function sliceBackupSnapshotsPage(
  sortedSnapshots: BackupSnapshotRecord[],
  options: ListBackupSnapshotsOptions,
): BackupSnapshotsPage {
  const startIndex = options.cursor ? sortedSnapshots.findIndex(snapshot => snapshot.id === options.cursor) + 1 : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const items = sortedSnapshots.slice(safeStartIndex, safeStartIndex + options.limit);
  const nextSnapshot = sortedSnapshots[safeStartIndex + options.limit];

  return {
    items,
    nextCursor: nextSnapshot?.id ?? null,
  };
}

/**
 * 按创建时间倒序排列备份快照。
 *
 * @param left 左侧快照。
 * @param right 右侧快照。
 * @returns 排序比较结果。
 */
function sortBackupSnapshotsByCreatedAtDesc(left: BackupSnapshotRecord, right: BackupSnapshotRecord): number {
  return right.createdAt.localeCompare(left.createdAt);
}
