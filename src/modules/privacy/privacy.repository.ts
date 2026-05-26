import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type {
  EncryptedVaultItemRecord,
  PrivacyCipherAlgorithm,
  PrivacyConfigRecord,
  PrivacyStorageMode,
  SyncEntityType,
} from "../../infrastructure/database/memory-store";
import { memoryPrivacyRepository } from "./privacy.memory-repository";
import { postgresPrivacyRepository } from "./privacy.postgres-repository";

export interface ListVaultItemsOptions {
  /** 当前页最后一条 vault item ID；为空时从第一页开始。 */
  cursor?: string;
  /** 按被加密实体类型过滤。 */
  entityType?: SyncEntityType;
  /** 本次最多返回的条目数量。 */
  limit: number;
}

export interface VaultItemsPage {
  /** 当前页端到端加密条目。 */
  items: EncryptedVaultItemRecord[];
  /** 下一页游标；没有更多数据时返回 `null`。 */
  nextCursor: string | null;
}

export interface CreateDefaultPrivacyConfigData {
  /** 用户 ID。 */
  userId: string;
  /** 创建时间。 */
  createdAt: string;
  /** 更新时间。 */
  updatedAt: string;
}

export interface UpdatePrivacyConfigData {
  /** 云端隐私存储模式。 */
  storageMode: PrivacyStorageMode;
  /** 当前加密算法。 */
  cipherAlgorithm: PrivacyCipherAlgorithm;
  /** 当前密钥版本。 */
  keyVersion: number;
  /** 是否启用端到端加密。 */
  e2eeEnabled: boolean;
  /** 是否启用恢复方案。 */
  recoveryEnabled: boolean;
  /** 更新时间。 */
  updatedAt: string;
}

export interface CreateVaultItemData {
  /** 后端生成的 vault item ID。 */
  id: string;
  /** 用户 ID。 */
  userId: string;
  /** 被托管密文归属的业务实体类型。 */
  entityType: SyncEntityType;
  /** 被托管密文归属的业务实体 ID。 */
  entityId: string;
  /** 加密算法。 */
  algorithm: EncryptedVaultItemRecord["algorithm"];
  /** 密钥版本。 */
  keyVersion: number;
  /** 加密随机数。 */
  nonce: string;
  /** 附加认证数据。 */
  aad: string | null;
  /** 密文正文。 */
  ciphertext: string;
  /** 内容摘要。 */
  contentHash: string;
  /** 创建时间。 */
  createdAt: string;
  /** 更新时间。 */
  updatedAt: string;
}

export interface UpdateVaultItemData {
  /** 加密算法。 */
  algorithm: EncryptedVaultItemRecord["algorithm"];
  /** 密钥版本。 */
  keyVersion: number;
  /** 加密随机数。 */
  nonce: string;
  /** 附加认证数据。 */
  aad: string | null;
  /** 密文正文。 */
  ciphertext: string;
  /** 内容摘要。 */
  contentHash: string;
  /** 更新时间。 */
  updatedAt: string;
}

/**
 * 隐私模块仓储接口。
 *
 * service 层负责会话、幂等、审计和同步日志；仓储层只处理隐私配置和端到端密文条目的
 * 持久化差异。
 */
export interface PrivacyRepository {
  /**
   * 查找用户隐私配置。
   *
   * @param userId 用户 ID。
   * @returns 用户隐私配置；不存在时返回 `null`。
   */
  findConfig(userId: string): Promise<PrivacyConfigRecord | null>;

  /**
   * 创建默认隐私配置。
   *
   * @param data 默认配置创建数据。
   * @returns 已创建的隐私配置。
   */
  createDefaultConfig(data: CreateDefaultPrivacyConfigData): Promise<PrivacyConfigRecord>;

  /**
   * 更新用户隐私配置。
   *
   * @param userId 用户 ID。
   * @param data 更新数据。
   * @returns 更新后的隐私配置；用户配置不存在时返回 `null`。
   */
  updateConfig(userId: string, data: UpdatePrivacyConfigData): Promise<PrivacyConfigRecord | null>;

  /**
   * 分页列出当前用户的端到端加密条目。
   *
   * @param userId 用户 ID。
   * @param options 分页与过滤参数。
   * @returns 当前页条目和下一页游标。
   */
  listVaultItems(userId: string, options: ListVaultItemsOptions): Promise<VaultItemsPage>;

  /**
   * 按业务实体定位端到端加密条目。
   *
   * @param userId 用户 ID。
   * @param entityType 实体类型。
   * @param entityId 实体 ID。
   * @returns 匹配的有效条目；不存在时返回 `null`。
   */
  findVaultItemByEntity(
    userId: string,
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<EncryptedVaultItemRecord | null>;

  /**
   * 创建端到端加密条目。
   *
   * @param data 已补齐 ID 和时间的密文条目。
   * @returns 已创建的密文条目。
   */
  createVaultItem(data: CreateVaultItemData): Promise<EncryptedVaultItemRecord>;

  /**
   * 更新端到端加密条目。
   *
   * @param userId 用户 ID。
   * @param itemId vault item ID。
   * @param data 更新数据。
   * @returns 更新后的密文条目；不存在、已删除或不属于用户时返回 `null`。
   */
  updateVaultItem(
    userId: string,
    itemId: string,
    data: UpdateVaultItemData,
  ): Promise<EncryptedVaultItemRecord | null>;
}

/**
 * 获取隐私模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的隐私仓储。
 */
export function getPrivacyRepository(): PrivacyRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresPrivacyRepository : memoryPrivacyRepository;
}
