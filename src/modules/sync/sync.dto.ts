import { z } from "zod";

/**
 * 增量同步变更查询参数。
 *
 * `afterVersion` 表示前端已处理的最后同步版本，`limit` 用来限制单次拉取数量，
 * 避免移动端恢复同步时一次性拉取过多数据。
 */
export const listSyncChangesQuerySchema = z.object({
  afterVersion: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

/**
 * 批量推送离线变更请求体。
 *
 * 这里先保留较宽的 `entityType / operation / payload` 形状，让 service 层逐条分发到
 * 当前已支持的业务 DTO。这样单条离线变更的校验失败可以落在该条结果中，而不是让整批
 * 请求直接失败。
 */
export const syncPushSchema = z.object({
  changes: z.array(z.object({
    clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
    entityType: z.string().min(1, "entityType 不能为空").max(80),
    operation: z.string().min(1, "operation 不能为空").max(40),
    payload: z.unknown(),
  })).min(1, "changes 至少需要一条变更").max(50, "单次最多推送 50 条变更"),
});

/**
 * 增量同步变更查询 DTO 类型。
 */
export type ListSyncChangesQuery = z.infer<typeof listSyncChangesQuerySchema>;

/**
 * 批量推送离线变更 DTO 类型。
 */
export type SyncPushInput = z.infer<typeof syncPushSchema>;

/**
 * 单条离线变更 DTO 类型。
 */
export type SyncPushChangeInput = SyncPushInput["changes"][number];
