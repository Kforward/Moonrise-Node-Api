import { z } from "zod";

const backupAlgorithmSchema = z.enum(["none", "aes-256-gcm", "xchacha20-poly1305"]);

export const listBackupSnapshotsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

export const backupSnapshotDetailQuerySchema = z.object({
  id: z.string().uuid("备份快照 ID 必须是 UUID"),
});

export const createBackupSnapshotSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: z.object({
    algorithm: backupAlgorithmSchema.default("none"),
    clientBackupId: z.string().min(1, "clientBackupId 不能为空").max(80),
    encrypted: z.boolean(),
    keyVersion: z.number().int().min(1).default(1),
    sizeBytes: z.number().int().min(1).max(20 * 1024 * 1024),
    snapshotCiphertext: z.string().min(1, "snapshotCiphertext 不能为空"),
    snapshotHash: z.string().min(1, "snapshotHash 不能为空").max(256),
  }),
});

export const restoreBackupSnapshotSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: z.object({
    id: z.string().uuid("备份快照 ID 必须是 UUID"),
  }),
});

export const deleteBackupSnapshotSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: z.object({
    id: z.string().uuid("备份快照 ID 必须是 UUID"),
  }),
});

export type ListBackupSnapshotsQuery = z.infer<typeof listBackupSnapshotsQuerySchema>;
export type BackupSnapshotDetailQuery = z.infer<typeof backupSnapshotDetailQuerySchema>;
export type CreateBackupSnapshotInput = z.infer<typeof createBackupSnapshotSchema>;
export type RestoreBackupSnapshotInput = z.infer<typeof restoreBackupSnapshotSchema>;
export type DeleteBackupSnapshotInput = z.infer<typeof deleteBackupSnapshotSchema>;
