import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  EncryptedVaultItemRecord,
  PrivacyCipherAlgorithm,
  PrivacyConfigRecord,
  SyncEntityType,
} from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { encryptedVaultItems, privacyConfigs } from "../../infrastructure/database/schema";
import type {
  CreateDefaultPrivacyConfigData,
  CreateVaultItemData,
  ListVaultItemsOptions,
  PrivacyRepository,
  UpdatePrivacyConfigData,
  UpdateVaultItemData,
  VaultItemsPage,
} from "./privacy.repository";

type PrivacyConfigRow = typeof privacyConfigs.$inferSelect;
type EncryptedVaultItemRow = typeof encryptedVaultItems.$inferSelect;

/**
 * PostgreSQL 版隐私仓储。
 *
 * 该实现承接 `privacy_configs` 与 `encrypted_vault_items` 的持久化读写，只返回当前
 * 用户拥有且未软删除的密文条目。
 */
export const postgresPrivacyRepository: PrivacyRepository = {
  /**
   * 查找 PostgreSQL 隐私配置。
   *
   * @param userId 用户 ID。
   * @returns 隐私配置；不存在时返回 `null`。
   */
  async findConfig(userId: string): Promise<PrivacyConfigRecord | null> {
    const [config] = await getDatabase()
      .select()
      .from(privacyConfigs)
      .where(eq(privacyConfigs.userId, userId))
      .limit(1);

    return config ? toPrivacyConfigRecord(config) : null;
  },

  /**
   * 创建 PostgreSQL 默认隐私配置。
   *
   * @param data 默认配置创建数据。
   * @returns 已创建的隐私配置。
   */
  async createDefaultConfig(data: CreateDefaultPrivacyConfigData): Promise<PrivacyConfigRecord> {
    const [config] = await getDatabase()
      .insert(privacyConfigs)
      .values({
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        userId: data.userId,
      })
      .returning();

    return toPrivacyConfigRecord(assertRow(config, "创建默认隐私配置失败"));
  },

  /**
   * 更新 PostgreSQL 隐私配置。
   *
   * @param userId 用户 ID。
   * @param data 更新数据。
   * @returns 更新后的隐私配置；不存在时返回 `null`。
   */
  async updateConfig(userId: string, data: UpdatePrivacyConfigData): Promise<PrivacyConfigRecord | null> {
    const [config] = await getDatabase()
      .update(privacyConfigs)
      .set(data)
      .where(eq(privacyConfigs.userId, userId))
      .returning();

    return config ? toPrivacyConfigRecord(config) : null;
  },

  /**
   * 分页列出 PostgreSQL 中的有效 vault items。
   *
   * @param userId 用户 ID。
   * @param options 分页与过滤参数。
   * @returns 当前页条目和下一页游标。
   */
  async listVaultItems(userId: string, options: ListVaultItemsOptions): Promise<VaultItemsPage> {
    const conditions = [
      eq(encryptedVaultItems.userId, userId),
      isNull(encryptedVaultItems.deletedAt),
    ];

    if (options.entityType) {
      conditions.push(eq(encryptedVaultItems.entityType, options.entityType));
    }

    const items = await getDatabase()
      .select()
      .from(encryptedVaultItems)
      .where(and(...conditions))
      .orderBy(desc(encryptedVaultItems.updatedAt));

    return sliceVaultItemsPage(items.map(toEncryptedVaultItemRecord), options);
  },

  /**
   * 按业务实体查找 PostgreSQL vault item。
   *
   * @param userId 用户 ID。
   * @param entityType 实体类型。
   * @param entityId 实体 ID。
   * @returns 有效条目；不存在时返回 `null`。
   */
  async findVaultItemByEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<EncryptedVaultItemRecord | null> {
    const [item] = await getDatabase()
      .select()
      .from(encryptedVaultItems)
      .where(and(
        eq(encryptedVaultItems.userId, userId),
        eq(encryptedVaultItems.entityType, entityType),
        eq(encryptedVaultItems.entityId, entityId),
        isNull(encryptedVaultItems.deletedAt),
      ))
      .limit(1);

    return item ? toEncryptedVaultItemRecord(item) : null;
  },

  /**
   * 创建 PostgreSQL vault item。
   *
   * @param data 已补齐 ID 和时间的密文条目。
   * @returns 已创建的条目。
   */
  async createVaultItem(data: CreateVaultItemData): Promise<EncryptedVaultItemRecord> {
    const [item] = await getDatabase()
      .insert(encryptedVaultItems)
      .values(data)
      .returning();

    return toEncryptedVaultItemRecord(assertRow(item, "创建端到端加密条目失败"));
  },

  /**
   * 更新 PostgreSQL vault item。
   *
   * @param userId 用户 ID。
   * @param itemId vault item ID。
   * @param data 更新数据。
   * @returns 更新后的条目；不存在时返回 `null`。
   */
  async updateVaultItem(
    userId: string,
    itemId: string,
    data: UpdateVaultItemData,
  ): Promise<EncryptedVaultItemRecord | null> {
    const [item] = await getDatabase()
      .update(encryptedVaultItems)
      .set(data)
      .where(and(
        eq(encryptedVaultItems.id, itemId),
        eq(encryptedVaultItems.userId, userId),
        isNull(encryptedVaultItems.deletedAt),
      ))
      .returning();

    return item ? toEncryptedVaultItemRecord(item) : null;
  },
};

/**
 * 按游标切分 PostgreSQL vault items 页。
 *
 * @param sortedItems 已按更新时间倒序排列的条目。
 * @param options 分页参数。
 * @returns 当前页条目和下一页游标。
 */
function sliceVaultItemsPage(
  sortedItems: EncryptedVaultItemRecord[],
  options: ListVaultItemsOptions,
): VaultItemsPage {
  const startIndex = options.cursor ? sortedItems.findIndex(item => item.id === options.cursor) + 1 : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const items = sortedItems.slice(safeStartIndex, safeStartIndex + options.limit);
  const nextItem = sortedItems[safeStartIndex + options.limit];

  return {
    items,
    nextCursor: nextItem?.id ?? null,
  };
}

/**
 * 确认数据库写入返回了记录。
 *
 * @param row Drizzle returning 返回的首条记录。
 * @param message 写入失败时用于内部排查的错误消息。
 * @returns 非空数据库记录。
 */
function assertRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) {
    throw new Error(message);
  }

  return row;
}

/**
 * 转换 PostgreSQL 隐私配置记录。
 *
 * @param row Drizzle 隐私配置行。
 * @returns service 层使用的隐私配置记录。
 */
function toPrivacyConfigRecord(row: PrivacyConfigRow): PrivacyConfigRecord {
  return {
    cipherAlgorithm: row.cipherAlgorithm,
    createdAt: row.createdAt,
    e2eeEnabled: row.e2eeEnabled,
    keyVersion: row.keyVersion,
    recoveryEnabled: row.recoveryEnabled,
    storageMode: row.storageMode,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

/**
 * 转换 PostgreSQL vault item 记录。
 *
 * @param row Drizzle 端到端加密条目行。
 * @returns service 层使用的 vault item 记录。
 */
function toEncryptedVaultItemRecord(row: EncryptedVaultItemRow): EncryptedVaultItemRecord {
  return {
    aad: row.aad,
    algorithm: toVaultCipherAlgorithm(row.algorithm),
    ciphertext: row.ciphertext,
    contentHash: row.contentHash,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    entityId: row.entityId,
    entityType: row.entityType,
    id: row.id,
    keyVersion: row.keyVersion,
    nonce: row.nonce,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

/**
 * 收窄 vault item 算法类型。
 *
 * `encrypted_vault_items` 复用全局隐私算法枚举，但业务接口不允许 vault item 使用
 * `none`，这里在读取时再次防御脏数据。
 *
 * @param algorithm 数据库中的算法值。
 * @returns 可用于 vault item 的真实加密算法。
 */
function toVaultCipherAlgorithm(algorithm: PrivacyCipherAlgorithm): EncryptedVaultItemRecord["algorithm"] {
  if (algorithm === "none") {
    throw new Error("端到端加密条目不能使用 none 算法");
  }

  return algorithm;
}
