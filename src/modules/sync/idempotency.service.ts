import { nowIso } from "../../common/utils/date-time";
import { getIdempotencyRepository } from "./idempotency.repository";

/**
 * 处理客户端幂等写入。
 *
 * 首次写入会保存响应快照，重复提交会直接返回历史响应；PostgreSQL 模式下快照保存在
 * `idempotency_records`，内存模式下保存在当前进程缓存中。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @param run 首次提交时执行的写入逻辑。
 * @returns 首次写入响应快照，或重复提交时的历史响应快照。
 */
export async function replayOrRunMutation<TResponse>(
  userId: string,
  clientMutationId: string,
  run: () => TResponse,
): Promise<TResponse> {
  return replayOrRunMutationAsync(userId, clientMutationId, async () => run());
}

/**
 * 处理客户端异步幂等写入。
 *
 * 该函数用于包含数据库写入、审计日志或外部适配器调用的写流程，保证首次响应快照
 * 会在异步副作用完成后再写入幂等缓存。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @param run 首次提交时执行的异步写入逻辑。
 * @returns 首次写入响应快照，或重复提交时的历史响应快照。
 */
export async function replayOrRunMutationAsync<TResponse>(
  userId: string,
  clientMutationId: string,
  run: () => Promise<TResponse>,
): Promise<TResponse> {
  const idempotencyRepository = getIdempotencyRepository();
  const existingMutation = await idempotencyRepository.findMutation(userId, clientMutationId);

  if (existingMutation) {
    return cloneMutationResponse(existingMutation.response as TResponse);
  }

  const response = await run();
  const responseSnapshot = cloneMutationResponse(response);

  const savedMutation = await idempotencyRepository.saveMutation({
    clientMutationId,
    createdAt: nowIso(),
    response: responseSnapshot,
    userId,
  });

  return cloneMutationResponse(savedMutation.response as TResponse);
}

/**
 * 复制幂等响应快照。
 *
 * 内存仓储中的业务记录会被后续写操作继续修改，因此幂等缓存必须保存独立快照，
 * 否则重复提交可能拿到已经被后续请求改变过的对象引用。
 *
 * @param response 即将写入或读出的幂等响应。
 * @returns 可安全缓存或返回给调用方的响应深拷贝。
 */
function cloneMutationResponse<TResponse>(response: TResponse): TResponse {
  return structuredClone(response);
}
