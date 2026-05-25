import type { MutationRecord } from "../../infrastructure/database/memory-store";
import type { IdempotencyRepository, SaveMutationSnapshotData } from "./idempotency.repository";
import { memoryIdempotencyRepository } from "./idempotency.memory-repository";

/**
 * PostgreSQL 运行模式下的幂等仓储。
 *
 * 当前 schema 尚未提供持久化响应快照表，因此这里复用内存快照实现，保障同一进程内
 * 重复提交仍能返回首次结果。数据库侧的防重由 `sync_change_logs(user_id, client_mutation_id)`
 * 唯一索引继续提供，后续可替换为真正的 PostgreSQL 幂等快照表。
 */
export const postgresIdempotencyRepository: IdempotencyRepository = {
  /**
   * 查找同一进程内的幂等响应快照。
   *
   * @param userId 用户 ID。
   * @param clientMutationId 客户端幂等键。
   * @returns 历史响应快照；不存在时返回 `null`。
   */
  async findMutation(userId: string, clientMutationId: string): Promise<MutationRecord | null> {
    return memoryIdempotencyRepository.findMutation(userId, clientMutationId);
  },

  /**
   * 保存同一进程内的幂等响应快照。
   *
   * @param data 幂等响应快照数据。
   * @returns 已保存的幂等响应快照。
   */
  async saveMutation(data: SaveMutationSnapshotData): Promise<MutationRecord> {
    return memoryIdempotencyRepository.saveMutation(data);
  },
};
