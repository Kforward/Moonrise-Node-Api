import { memoryStore, type MutationRecord } from "../../infrastructure/database/memory-store";
import type { IdempotencyRepository, SaveMutationSnapshotData } from "./idempotency.repository";

/**
 * 内存版幂等仓储。
 *
 * 该实现保存首次响应快照，并在同一进程内对重复 `clientMutationId` 返回历史响应。
 */
export const memoryIdempotencyRepository: IdempotencyRepository = {
  /**
   * 查找内存中的幂等响应快照。
   *
   * @param userId 用户 ID。
   * @param clientMutationId 客户端幂等键。
   * @returns 历史响应快照；不存在时返回 `null`。
   */
  async findMutation(userId: string, clientMutationId: string): Promise<MutationRecord | null> {
    return memoryStore.mutations.get(buildMutationKey(userId, clientMutationId)) ?? null;
  },

  /**
   * 保存内存幂等响应快照。
   *
   * @param data 幂等响应快照数据。
   * @returns 已保存的幂等响应快照。
   */
  async saveMutation(data: SaveMutationSnapshotData): Promise<MutationRecord> {
    const mutation: MutationRecord = {
      clientMutationId: data.clientMutationId,
      createdAt: data.createdAt,
      response: data.response,
      userId: data.userId,
    };

    memoryStore.mutations.set(buildMutationKey(data.userId, data.clientMutationId), mutation);

    return mutation;
  },
};

/**
 * 构造内存幂等缓存键。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @returns 内存 Map 使用的复合键。
 */
function buildMutationKey(userId: string, clientMutationId: string): string {
  return `${userId}:${clientMutationId}`;
}
