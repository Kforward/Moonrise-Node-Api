import {
  memoryStore,
  type EncryptedVaultItemRecord,
  type PrivacyConfigRecord,
  type SyncEntityType,
} from "../../infrastructure/database/memory-store";
import type {
  CreateDefaultPrivacyConfigData,
  CreateVaultItemData,
  ListVaultItemsOptions,
  PrivacyRepository,
  UpdatePrivacyConfigData,
  UpdateVaultItemData,
  VaultItemsPage,
} from "./privacy.repository";

/**
 * 内存版隐私仓储。
 *
 * 该实现用于开发期和集成测试，保持与 PostgreSQL 仓储一致的分页、归属校验和软删除过滤
 * 行为。
 */
export const memoryPrivacyRepository: PrivacyRepository = {
  /**
   * 查找内存隐私配置。
   *
   * @param userId 用户 ID。
   * @returns 隐私配置；不存在时返回 `null`。
   */
  async findConfig(userId: string): Promise<PrivacyConfigRecord | null> {
    return memoryStore.privacyConfigs.get(userId) ?? null;
  },

  /**
   * 创建内存默认隐私配置。
   *
   * @param data 默认配置创建数据。
   * @returns 已创建的隐私配置。
   */
  async createDefaultConfig(data: CreateDefaultPrivacyConfigData): Promise<PrivacyConfigRecord> {
    const config: PrivacyConfigRecord = {
      cipherAlgorithm: "none",
      createdAt: data.createdAt,
      e2eeEnabled: false,
      keyVersion: 1,
      recoveryEnabled: false,
      storageMode: "plain",
      updatedAt: data.updatedAt,
      userId: data.userId,
    };

    memoryStore.privacyConfigs.set(data.userId, config);

    return config;
  },

  /**
   * 更新内存隐私配置。
   *
   * @param userId 用户 ID。
   * @param data 更新数据。
   * @returns 更新后的隐私配置；不存在时返回 `null`。
   */
  async updateConfig(userId: string, data: UpdatePrivacyConfigData): Promise<PrivacyConfigRecord | null> {
    const config = memoryStore.privacyConfigs.get(userId);

    if (!config) {
      return null;
    }

    config.cipherAlgorithm = data.cipherAlgorithm;
    config.e2eeEnabled = data.e2eeEnabled;
    config.keyVersion = data.keyVersion;
    config.recoveryEnabled = data.recoveryEnabled;
    config.storageMode = data.storageMode;
    config.updatedAt = data.updatedAt;

    return config;
  },

  /**
   * 分页列出内存中的有效 vault items。
   *
   * @param userId 用户 ID。
   * @param options 分页与过滤参数。
   * @returns 当前页条目和下一页游标。
   */
  async listVaultItems(userId: string, options: ListVaultItemsOptions): Promise<VaultItemsPage> {
    const items = listActiveVaultItems(userId, options.entityType);

    return sliceVaultItemsPage(items, options);
  },

  /**
   * 按业务实体查找内存 vault item。
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
    return [...memoryStore.encryptedVaultItems.values()].find(item =>
      item.userId === userId &&
      item.entityType === entityType &&
      item.entityId === entityId &&
      !item.deletedAt
    ) ?? null;
  },

  /**
   * 创建内存 vault item。
   *
   * @param data 已补齐 ID 和时间的密文条目。
   * @returns 已创建的条目。
   */
  async createVaultItem(data: CreateVaultItemData): Promise<EncryptedVaultItemRecord> {
    const item: EncryptedVaultItemRecord = {
      ...data,
      deletedAt: null,
    };

    memoryStore.encryptedVaultItems.set(item.id, item);

    return item;
  },

  /**
   * 更新内存 vault item。
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
    const item = memoryStore.encryptedVaultItems.get(itemId);

    if (!item || item.userId !== userId || item.deletedAt) {
      return null;
    }

    item.aad = data.aad;
    item.algorithm = data.algorithm;
    item.ciphertext = data.ciphertext;
    item.contentHash = data.contentHash;
    item.keyVersion = data.keyVersion;
    item.nonce = data.nonce;
    item.updatedAt = data.updatedAt;

    return item;
  },
};

/**
 * 列出指定用户有效 vault items 并按更新时间倒序排列。
 *
 * @param userId 用户 ID。
 * @param entityType 可选实体类型过滤。
 * @returns 已排序的有效密文条目。
 */
function listActiveVaultItems(userId: string, entityType?: SyncEntityType): EncryptedVaultItemRecord[] {
  return [...memoryStore.encryptedVaultItems.values()]
    .filter(item => item.userId === userId && !item.deletedAt)
    .filter(item => !entityType || item.entityType === entityType)
    .sort(sortVaultItemsByUpdatedAtDesc);
}

/**
 * 按游标切分页。
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
 * 按更新时间倒序排列 vault items。
 *
 * @param left 左侧条目。
 * @param right 右侧条目。
 * @returns 排序比较结果。
 */
function sortVaultItemsByUpdatedAtDesc(
  left: EncryptedVaultItemRecord,
  right: EncryptedVaultItemRecord,
): number {
  return right.updatedAt.localeCompare(left.updatedAt);
}
