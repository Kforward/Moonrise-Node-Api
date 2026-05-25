import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type { MutationRecord } from "../../infrastructure/database/memory-store";
import { memoryIdempotencyRepository } from "./idempotency.memory-repository";
import { postgresIdempotencyRepository } from "./idempotency.postgres-repository";

export interface SaveMutationSnapshotData {
  /** 用户 ID。 */
  userId: string;
  /** 客户端幂等键。 */
  clientMutationId: string;
  /** 已复制的响应快照。 */
  response: unknown;
  /** 服务端记录快照的时间。 */
  createdAt: string;
}

/**
 * 幂等响应快照仓储接口。
 *
 * 内存模式用于前端本地联调，PostgreSQL 模式用于持久化保存首次响应快照；service 层只
 * 依赖该接口，不直接关心底层存储方式。
 */
export interface IdempotencyRepository {
  /**
   * 查找指定用户和客户端幂等键的历史响应快照。
   *
   * @param userId 用户 ID。
   * @param clientMutationId 客户端幂等键。
   * @returns 历史响应快照；不存在时返回 `null`。
   */
  findMutation(userId: string, clientMutationId: string): Promise<MutationRecord | null>;

  /**
   * 保存首次写入的响应快照。
   *
   * @param data 幂等响应快照数据。
   * @returns 已保存的幂等响应快照。
   */
  saveMutation(data: SaveMutationSnapshotData): Promise<MutationRecord>;
}

/**
 * 获取幂等仓储实现。
 *
 * @returns 当前数据库运行模式对应的幂等仓储。
 */
export function getIdempotencyRepository(): IdempotencyRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresIdempotencyRepository : memoryIdempotencyRepository;
}
