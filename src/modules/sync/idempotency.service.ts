import { nowIso } from "../../common/utils/date-time";
import { memoryStore } from "../../infrastructure/database/memory-store";

/**
 * 处理客户端幂等写入。
 *
 * 当前开发期实现保存首次响应快照并在重复提交时原样返回；后续 PostgreSQL 实现应使用
 * `sync_change_logs(user_id, client_mutation_id)` 唯一约束保证并发安全。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @param run 首次提交时执行的写入逻辑。
 */
export function replayOrRunMutation<TResponse>(userId: string, clientMutationId: string, run: () => TResponse): TResponse {
  const mutationKey = `${userId}:${clientMutationId}`;
  const existingMutation = memoryStore.mutations.get(mutationKey);

  if (existingMutation) {
    return cloneMutationResponse(existingMutation.response as TResponse);
  }

  const response = run();
  const responseSnapshot = cloneMutationResponse(response);

  memoryStore.mutations.set(mutationKey, {
    clientMutationId,
    createdAt: nowIso(),
    response: responseSnapshot,
    userId,
  });

  return cloneMutationResponse(responseSnapshot);
}

/**
 * 复制幂等响应快照。
 *
 * 内存仓储中的业务记录会被后续写操作继续修改，因此幂等缓存必须保存独立快照，
 * 否则重复提交可能拿到已经被后续请求改变过的对象引用。
 *
 * @param response 即将写入或读出的幂等响应。
 */
function cloneMutationResponse<TResponse>(response: TResponse): TResponse {
  return structuredClone(response);
}
