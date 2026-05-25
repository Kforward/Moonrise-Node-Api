import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type { BackupSnapshotRecord } from "../../infrastructure/database/memory-store";
import { memoryBackupRepository } from "./backup.memory-repository";
import { postgresBackupRepository } from "./backup.postgres-repository";

export interface ListBackupSnapshotsOptions {
  /** 当前页最后一条快照 ID；为空时从第一页开始。 */
  cursor?: string;
  /** 本次最多返回的快照数量。 */
  limit: number;
}

export interface BackupSnapshotsPage {
  /** 当前页有效备份快照。 */
  items: BackupSnapshotRecord[];
  /** 下一页游标；没有更多数据时返回 `null`。 */
  nextCursor: string | null;
}

export interface CreateBackupSnapshotData {
  /** 后端生成的备份快照 ID。 */
  id: string;
  /** 用户 ID。 */
  userId: string;
  /** 客户端备份 ID，用于幂等和前端本地映射。 */
  clientBackupId: string;
  /** 快照是否已加密。 */
  encrypted: boolean;
  /** 快照加密算法。 */
  algorithm: BackupSnapshotRecord["algorithm"];
  /** 密钥版本。 */
  keyVersion: number;
  /** 快照大小，单位字节。 */
  sizeBytes: number;
  /** 完整快照密文。 */
  snapshotCiphertext: string;
  /** 快照摘要。 */
  snapshotHash: string;
  /** 创建时间。 */
  createdAt: string;
  /** 更新时间。 */
  updatedAt: string;
}

/**
 * 备份模块仓储接口。
 *
 * service 层负责幂等、审计、同步日志和保留策略；仓储层只屏蔽内存与 PostgreSQL 的
 * 持久化差异。
 */
export interface BackupRepository {
  /**
   * 分页列出指定用户的有效备份快照。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页快照元数据和下一页游标。
   */
  listSnapshots(userId: string, options: ListBackupSnapshotsOptions): Promise<BackupSnapshotsPage>;

  /**
   * 按 ID 查找有效备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 快照 ID。
   * @returns 有效快照；不存在、已删除或不属于用户时返回 `null`。
   */
  findActiveSnapshot(userId: string, snapshotId: string): Promise<BackupSnapshotRecord | null>;

  /**
   * 按客户端备份 ID 查找快照。
   *
   * @param userId 用户 ID。
   * @param clientBackupId 客户端备份 ID。
   * @returns 快照记录；不存在时返回 `null`。
   */
  findSnapshotByClientBackupId(userId: string, clientBackupId: string): Promise<BackupSnapshotRecord | null>;

  /**
   * 创建备份快照。
   *
   * @param data 已补齐 ID 和时间的快照数据。
   * @returns 已创建的快照记录。
   */
  createSnapshot(data: CreateBackupSnapshotData): Promise<BackupSnapshotRecord>;

  /**
   * 软删除备份快照。
   *
   * @param userId 用户 ID。
   * @param snapshotId 快照 ID。
   * @param deletedAt 软删除时间。
   * @returns 删除后的快照；不存在、已删除或不属于用户时返回 `null`。
   */
  softDeleteSnapshot(userId: string, snapshotId: string, deletedAt: string): Promise<BackupSnapshotRecord | null>;

  /**
   * 保留指定数量的最新有效快照并软删除更早的快照。
   *
   * @param userId 用户 ID。
   * @param keepLatestCount 需要保留的最新有效快照数量。
   * @param deletedAt 软删除时间。
   * @returns 被保留策略软删除的快照列表。
   */
  pruneSnapshots(userId: string, keepLatestCount: number, deletedAt: string): Promise<BackupSnapshotRecord[]>;
}

/**
 * 获取备份模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的备份仓储。
 */
export function getBackupRepository(): BackupRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresBackupRepository : memoryBackupRepository;
}
