import { z } from "zod";

const privacyStorageModeSchema = z.enum(["plain", "encrypted", "e2ee"]);
const privacyCipherAlgorithmSchema = z.enum([
  "none",
  "aes-256-cbc-hmac-sha256",
  "aes-256-gcm",
  "xchacha20-poly1305",
]);
const vaultCipherAlgorithmSchema = z.enum([
  "aes-256-cbc-hmac-sha256",
  "aes-256-gcm",
  "xchacha20-poly1305",
]);
const syncEntityTypeSchema = z.enum([
  "user_profile",
  "cycle_settings",
  "period_record",
  "backup_snapshot",
  "privacy_config",
  "vault_item",
]);

/**
 * 隐私配置更新 DTO。
 *
 * 配置只保存模式、算法和密钥版本。明文主密钥、恢复口令和端到端加密私钥都不允许进入
 * 后端业务接口。
 */
export const updatePrivacyConfigSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: z.object({
    cipherAlgorithm: privacyCipherAlgorithmSchema,
    e2eeEnabled: z.boolean(),
    keyVersion: z.number().int().min(1),
    recoveryEnabled: z.boolean(),
    storageMode: privacyStorageModeSchema,
  }),
}).superRefine((input, context) => {
  const payload = input.payload;

  if (payload.storageMode === "plain" && payload.cipherAlgorithm !== "none") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "plain 模式必须使用 none 算法",
      path: ["payload", "cipherAlgorithm"],
    });
  }

  if (payload.storageMode !== "plain" && payload.cipherAlgorithm === "none") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "加密模式必须指定真实加密算法",
      path: ["payload", "cipherAlgorithm"],
    });
  }

  if (payload.storageMode === "e2ee" && !payload.e2eeEnabled) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "e2ee 模式必须启用端到端加密标记",
      path: ["payload", "e2eeEnabled"],
    });
  }

  if (payload.storageMode !== "e2ee" && payload.e2eeEnabled) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "只有 e2ee 模式可以启用端到端加密标记",
      path: ["payload", "e2eeEnabled"],
    });
  }

  if (payload.storageMode === "plain" && payload.recoveryEnabled) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "plain 模式不需要启用恢复方案",
      path: ["payload", "recoveryEnabled"],
    });
  }
});

/**
 * 加密保险箱条目保存 DTO。
 *
 * 服务端只保存密文和加密元数据，不解析 `ciphertext`，也不要求前端上传任何可解密的
 * 明文材料。
 */
export const saveVaultItemSchema = z.object({
  clientMutationId: z.string().min(1, "clientMutationId 不能为空").max(120),
  payload: z.object({
    aad: z.string().min(1).max(2000).nullable().optional(),
    algorithm: vaultCipherAlgorithmSchema,
    ciphertext: z.string().min(1, "ciphertext 不能为空").max(2 * 1024 * 1024),
    contentHash: z.string().min(1, "contentHash 不能为空").max(256),
    entityId: z.string().min(1, "entityId 不能为空").max(120),
    entityType: syncEntityTypeSchema,
    keyVersion: z.number().int().min(1),
    nonce: z.string().min(1, "nonce 不能为空").max(500),
  }),
});

/**
 * 加密保险箱条目列表查询 DTO。
 */
export const listVaultItemsQuerySchema = z.object({
  cursor: z.string().optional(),
  entityType: syncEntityTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdatePrivacyConfigInput = z.infer<typeof updatePrivacyConfigSchema>;
export type SaveVaultItemInput = z.infer<typeof saveVaultItemSchema>;
export type ListVaultItemsQuery = z.infer<typeof listVaultItemsQuerySchema>;
