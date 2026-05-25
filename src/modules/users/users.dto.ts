import { z } from "zod";

export const updateUserProfileSchema = z.object({
  payload: z.object({
    avatarUrl: z.string().url().nullable().optional(),
    emailCiphertext: z.string().min(1).nullable().optional(),
    gender: z.number().int().min(0).max(2).optional(),
    nickname: z.string().min(1).max(80).nullable().optional(),
    phoneCiphertext: z.string().min(1).nullable().optional(),
    profileCiphertext: z.string().min(1).nullable().optional(),
  }),
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
});

export const revokeDeviceSchema = z.object({
  payload: z.object({
    deviceId: z.string().uuid("deviceId 必须是 UUID"),
  }),
  clientMutationId: z.string().min(1, "clientMutationId 不能为空"),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
export type RevokeDeviceInput = z.infer<typeof revokeDeviceSchema>;
