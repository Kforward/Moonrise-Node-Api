import { z } from "zod";

const businessDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须是 YYYY-MM-DD");
const reminderTimeSchema = z.string().regex(/^\d{2}:\d{2}$/, "提醒时间格式必须是 HH:mm");

export const updateCycleSettingsSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
  payload: z.object({
    avgCycleLength: z.number().int().min(15).max(100),
    avgPeriodLength: z.number().int().min(2).max(14),
    reminderDaysAhead: z.number().int().min(0).max(14),
    reminderEnabled: z.boolean(),
    reminderTime: reminderTimeSchema,
    clientUpdatedAt: z.string().datetime().nullable().optional(),
  }),
});

export const listPeriodRecordsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createPeriodRecordSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
  payload: z.object({
    clientRecordId: z.string().min(1).max(80),
    startDate: businessDateSchema,
    endDate: businessDateSchema.nullable().optional(),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    painLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    moods: z.array(z.string().min(1).max(40)).default([]),
    notesCiphertext: z.string().min(1).nullable().optional(),
    clientUpdatedAt: z.string().datetime().nullable().optional(),
  }),
});

export const updatePeriodRecordSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
  payload: z.object({
    id: z.string().uuid(),
    startDate: businessDateSchema.optional(),
    endDate: businessDateSchema.nullable().optional(),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    painLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    moods: z.array(z.string().min(1).max(40)).optional(),
    notesCiphertext: z.string().min(1).nullable().optional(),
    clientUpdatedAt: z.string().datetime().nullable().optional(),
  }),
});

export const deletePeriodRecordSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
  payload: z.object({
    id: z.string().uuid(),
  }),
});

export const finishPeriodRecordSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
  payload: z.object({
    id: z.string().uuid(),
    endDate: businessDateSchema,
    clientUpdatedAt: z.string().datetime().nullable().optional(),
  }),
});

export type UpdateCycleSettingsInput = z.infer<typeof updateCycleSettingsSchema>;
export type ListPeriodRecordsQuery = z.infer<typeof listPeriodRecordsQuerySchema>;
export type CreatePeriodRecordInput = z.infer<typeof createPeriodRecordSchema>;
export type UpdatePeriodRecordInput = z.infer<typeof updatePeriodRecordSchema>;
export type DeletePeriodRecordInput = z.infer<typeof deletePeriodRecordSchema>;
export type FinishPeriodRecordInput = z.infer<typeof finishPeriodRecordSchema>;
