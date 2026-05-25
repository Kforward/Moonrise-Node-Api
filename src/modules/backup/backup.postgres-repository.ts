import { and, desc, eq, isNull } from "drizzle-orm";
import type { BackupSnapshotRecord } from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { backupSnapshots } from "../../infrastructure/database/schema";
import type {
  BackupRepository,
  BackupSnapshotsPage,
  CreateBackupSnapshotData,
  ListBackupSnapshotsOptions,
} from "./backup.repository";

type BackupSnapshotRow = typeof backupSnapshots.$inferSelect;

/**
 * PostgreSQL 版备份仓储。
 *
 * 该实现承接 `backup_snapshots` 的持久化读写，只返回未软删除快照，确保列表、详情、
 * 恢复和删除都不会误操作其他用户或已删除数据。
 */
export const postgresBackupRepository: BackupRepository = {
  /**
   * 从 PostgreSQL 分页列出有效备份快照。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页快照元数据和下一页游标。
   */
  async listSnapshots(userId: string, options: ListBackupSnapshotsOptions): Promise<BackupSnapshotsPage> {
    const snapshots = await getDatabase()
      .select()
      .from(backupSnapshots)
      .where(and(
        eq(backupSnapshots.userId, userId),
        isNull(backupSnapshots.deletedAt),
      ))
      .orderBy(desc(backupSnapshots.createdAt));

    return sliceBackupSnapshotsPage(snapshots.map(toBackupSnapshotRecord), options);
  },

  /**
   * 从 PostgreSQL 查找有效备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 备份快照 ID。
   * @returns 有效快照；不存在、已删除或不属于用户时返回 `null`。
   */
  async findActiveSnapshot(userId: string, snapshotId: string): Promise<BackupSnapshotRecord | null> {
    const [snapshot] = await getDatabase()
      .select()
      .from(backupSnapshots)
      .where(and(
        eq(backupSnapshots.id, snapshotId),
        eq(backupSnapshots.userId, userId),
        isNull(backupSnapshots.deletedAt),
      ))
      .limit(1);

    return snapshot ? toBackupSnapshotRecord(snapshot) : null;
  },

  /**
   * 按客户端备份 ID 查找 PostgreSQL 快照。
   *
   * @param userId 用户 ID。
   * @param clientBackupId 客户端备份 ID。
   * @returns 快照记录；不存在时返回 `null`。
   */
  async findSnapshotByClientBackupId(userId: string, clientBackupId: string): Promise<BackupSnapshotRecord | null> {
    const [snapshot] = await getDatabase()
      .select()
      .from(backupSnapshots)
      .where(and(
        eq(backupSnapshots.userId, userId),
        eq(backupSnapshots.clientBackupId, clientBackupId),
      ))
      .limit(1);

    return snapshot ? toBackupSnapshotRecord(snapshot) : null;
  },

  /**
   * 创建 PostgreSQL 备份快照。
   *
   * @param data 已补齐 ID 和时间的快照数据。
   * @returns 已创建的快照记录。
   */
  async createSnapshot(data: CreateBackupSnapshotData): Promise<BackupSnapshotRecord> {
    const [snapshot] = await getDatabase()
      .insert(backupSnapshots)
      .values(data)
      .returning();

    return toBackupSnapshotRecord(assertRow(snapshot, "创建备份快照失败"));
  },

  /**
   * 在 PostgreSQL 中软删除备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 备份快照 ID。
   * @param deletedAt 软删除时间。
   * @returns 删除后的快照；不存在、已删除或不属于用户时返回 `null`。
   */
  async softDeleteSnapshot(userId: string, snapshotId: string, deletedAt: string): Promise<BackupSnapshotRecord | null> {
    const [snapshot] = await getDatabase()
      .update(backupSnapshots)
      .set({
        deletedAt,
        updatedAt: deletedAt,
      })
      .where(and(
        eq(backupSnapshots.id, snapshotId),
        eq(backupSnapshots.userId, userId),
        isNull(backupSnapshots.deletedAt),
      ))
      .returning();

    return snapshot ? toBackupSnapshotRecord(snapshot) : null;
  },

  /**
   * 按保留策略软删除较早的 PostgreSQL 备份快照。
   *
   * @param userId 用户 ID。
   * @param keepLatestCount 需要保留的最新有效快照数量。
   * @param deletedAt 软删除时间。
   * @returns 被软删除的快照列表。
   */
  async pruneSnapshots(userId: string, keepLatestCount: number, deletedAt: string): Promise<BackupSnapshotRecord[]> {
    const activeSnapshots = await getDatabase()
      .select()
      .from(backupSnapshots)
      .where(and(
        eq(backupSnapshots.userId, userId),
        isNull(backupSnapshots.deletedAt),
      ))
      .orderBy(desc(backupSnapshots.createdAt));
    const snapshotsToDelete = activeSnapshots.slice(keepLatestCount);
    const deletedSnapshots: BackupSnapshotRecord[] = [];

    for (const snapshot of snapshotsToDelete) {
      const deletedSnapshot = await this.softDeleteSnapshot(userId, snapshot.id, deletedAt);

      if (deletedSnapshot) {
        deletedSnapshots.push(deletedSnapshot);
      }
    }

    return deletedSnapshots;
  },
};

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
 * 转换 PostgreSQL 备份快照记录。
 *
 * @param row Drizzle 备份快照行。
 * @returns service 层使用的备份快照记录。
 */
function toBackupSnapshotRecord(row: BackupSnapshotRow): BackupSnapshotRecord {
  return {
    algorithm: row.algorithm,
    clientBackupId: row.clientBackupId,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    encrypted: row.encrypted,
    id: row.id,
    keyVersion: row.keyVersion,
    sizeBytes: row.sizeBytes,
    snapshotCiphertext: row.snapshotCiphertext,
    snapshotHash: row.snapshotHash,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}
