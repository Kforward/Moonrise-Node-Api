import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type { SyncChangeLogRecord, SyncEntityType, SyncOperation } from "../../infrastructure/database/memory-store";
import { memorySyncRepository } from "./sync.memory-repository";
import { postgresSyncRepository } from "./sync.postgres-repository";

export interface AppendSyncChangeData {
  /** 变更所属用户 ID。 */
  userId: string;
  /** 被修改的实体类型。 */
  entityType: SyncEntityType;
  /** 被修改的实体 ID。 */
  entityId: string;
  /** 本次同步变更的操作类型。 */
  operation: SyncOperation;
  /** 实体自身版本；当前无实体级版本时允许为空。 */
  entityVersion: number | null;
  /** 前端生成的幂等变更 ID，用于排查和后续去重。 */
  clientMutationId: string | null;
  /** 同步变更完整性校验摘要。 */
  checksum: string;
  /** 服务端生成的变更创建时间。 */
  createdAt: string;
}

export interface ListSyncChangesOptions {
  /** 已同步到客户端的最新版本号。 */
  afterVersion: number;
  /** 本次最多返回的变更数量。 */
  limit: number;
}

export interface SyncChangesPage {
  /** 当前页同步变更。 */
  items: SyncChangeLogRecord[];
  /** 下一次拉取应使用的同步版本游标。 */
  nextVersion: number;
}

/**
 * 同步模块仓储接口。
 *
 * 该接口隔离内存数组和 PostgreSQL `sync_change_logs` 表的差异，让 service 层只关注
 * 同步业务语义和会话校验。
 */
export interface SyncRepository {
  /**
   * 写入一条同步变更日志。
   *
   * @param data 已补齐 checksum 和创建时间的同步变更数据。
   * @returns 已写入的同步变更日志。
   */
  appendChange(data: AppendSyncChangeData): Promise<SyncChangeLogRecord>;

  /**
   * 按版本游标拉取用户增量同步变更。
   *
   * @param userId 用户 ID。
   * @param options 增量查询参数。
   * @returns 当前页变更列表和下一次拉取游标。
   */
  listChanges(userId: string, options: ListSyncChangesOptions): Promise<SyncChangesPage>;

  /**
   * 获取用户当前同步水位。
   *
   * @param userId 用户 ID。
   * @returns 当前用户最新同步版本号。
   */
  getLatestVersion(userId: string): Promise<number>;
}

/**
 * 获取同步模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的同步仓储。
 */
export function getSyncRepository(): SyncRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresSyncRepository : memorySyncRepository;
}
