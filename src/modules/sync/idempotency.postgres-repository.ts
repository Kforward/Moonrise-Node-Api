import { and, eq } from "drizzle-orm";
import type { MutationRecord } from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { idempotencyRecords } from "../../infrastructure/database/schema";
import type { IdempotencyRepository, SaveMutationSnapshotData } from "./idempotency.repository";

type IdempotencyRecordRow = typeof idempotencyRecords.$inferSelect;

/**
 * PostgreSQL 版幂等仓储。
 *
 * 该实现将写接口的首次响应快照保存到 `idempotency_records`，让服务重启、横向扩容或
 * 前端跨进程重试时仍能稳定返回首次处理结果。
 */
export const postgresIdempotencyRepository: IdempotencyRepository = {
  /**
   * 从 PostgreSQL 查找幂等响应快照。
   *
   * @param userId 用户 ID。
   * @param clientMutationId 客户端幂等键。
   * @returns 历史响应快照；不存在时返回 `null`。
   */
  async findMutation(userId: string, clientMutationId: string): Promise<MutationRecord | null> {
    return findPersistedMutation(userId, clientMutationId);
  },

  /**
   * 保存 PostgreSQL 幂等响应快照。
   *
   * 使用唯一约束保证同一用户、同一 `clientMutationId` 只保存首次响应；如果插入时发现
   * 已存在快照，则回读数据库中的历史结果，避免覆盖首次响应。
   *
   * @param data 幂等响应快照数据。
   * @returns 已保存的幂等响应快照。
   */
  async saveMutation(data: SaveMutationSnapshotData): Promise<MutationRecord> {
    const [createdMutation] = await getDatabase()
      .insert(idempotencyRecords)
      .values({
        clientMutationId: data.clientMutationId,
        createdAt: data.createdAt,
        response: data.response,
        userId: data.userId,
      })
      .onConflictDoNothing({
        target: [
          idempotencyRecords.userId,
          idempotencyRecords.clientMutationId,
        ],
      })
      .returning();

    if (createdMutation) {
      return toMutationRecord(createdMutation);
    }

    const existingMutation = await findPersistedMutation(data.userId, data.clientMutationId);

    if (!existingMutation) {
      throw new Error("保存幂等响应快照失败");
    }

    return existingMutation;
  },
};

/**
 * 从数据库读取指定用户的幂等响应快照。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @returns 历史响应快照；不存在时返回 `null`。
 */
async function findPersistedMutation(userId: string, clientMutationId: string): Promise<MutationRecord | null> {
  const [mutation] = await getDatabase()
    .select()
    .from(idempotencyRecords)
    .where(and(
      eq(idempotencyRecords.userId, userId),
      eq(idempotencyRecords.clientMutationId, clientMutationId),
    ))
    .limit(1);

  return mutation ? toMutationRecord(mutation) : null;
}

/**
 * 转换 PostgreSQL 幂等快照记录。
 *
 * @param row Drizzle 幂等快照行。
 * @returns service 层使用的幂等快照记录。
 */
function toMutationRecord(row: IdempotencyRecordRow): MutationRecord {
  return {
    clientMutationId: row.clientMutationId,
    createdAt: row.createdAt,
    response: row.response,
    userId: row.userId,
  };
}
