import { z } from "zod";

const appPreferencesPayloadSchema = z.object({
  emptyGuideSkipped: z.boolean().optional(),
  historyEntryHintDismissed: z.boolean().optional(),
}).refine(payload =>
  payload.emptyGuideSkipped !== undefined || payload.historyEntryHintDismissed !== undefined,
{
  message: "至少需要更新一个偏好字段",
});

export const updateAppPreferencesSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: appPreferencesPayloadSchema,
});

export const listAppReleasesQuerySchema = z.object({
  cursor: z.string().uuid("cursor 必须是更新日志 ID").optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const appReleaseDetailQuerySchema = z.object({
  version: z.string().min(1, "version 不能为空").max(40),
});

export type UpdateAppPreferencesInput = z.infer<typeof updateAppPreferencesSchema>;
export type ListAppReleasesQuery = z.infer<typeof listAppReleasesQuerySchema>;
export type AppReleaseDetailQuery = z.infer<typeof appReleaseDetailQuerySchema>;
