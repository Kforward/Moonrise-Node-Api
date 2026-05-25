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
 * 增量同步变更查询 DTO 类型。
 */
export type ListSyncChangesQuery = z.infer<typeof listSyncChangesQuerySchema>;
