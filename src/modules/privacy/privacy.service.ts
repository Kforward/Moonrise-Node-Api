import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import type { EncryptedVaultItemRecord, PrivacyConfigRecord } from "../../infrastructure/database/memory-store";
import { appendAuditLog } from "../audit/audit.service";
import { requireActiveSession } from "../auth/auth.service";
import { replayOrRunMutationAsync } from "../sync/idempotency.service";
import { appendSyncChangeAsync } from "../sync/sync-log.service";
import type { ListVaultItemsQuery, SaveVaultItemInput, UpdatePrivacyConfigInput } from "./privacy.dto";
import { getPrivacyRepository } from "./privacy.repository";

interface PublicPrivacyConfig {
  userId: string;
  storageMode: PrivacyConfigRecord["storageMode"];
  cipherAlgorithm: PrivacyConfigRecord["cipherAlgorithm"];
  keyVersion: number;
  e2eeEnabled: boolean;
  recoveryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PublicVaultItem {
  id: string;
  entityType: EncryptedVaultItemRecord["entityType"];
  entityId: string;
  algorithm: EncryptedVaultItemRecord["algorithm"];
  keyVersion: number;
  nonce: string;
  aad: string | null;
  ciphertext: string;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取当前用户隐私配置。
 *
 * 老数据可能只有用户资料和周期设置，没有隐私配置；读取时会补一条默认配置，保证前端
 * 始终拿到稳定结构。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户隐私配置。
 */
export async function getPrivacyConfig(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const config = await findOrCreatePrivacyConfig(session.user.id);

  return {
    config: toPublicPrivacyConfig(config),
  };
}

/**
 * 更新当前用户隐私配置。
 *
 * 写入后会记录审计日志和同步日志。审计日志只保存模式、算法、密钥版本等元数据，不记录
 * 任何密钥、恢复口令或密文正文。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 隐私配置更新 DTO。
 * @returns 更新后的隐私配置。
 */
export async function updatePrivacyConfig(currentSession: CurrentSession, input: UpdatePrivacyConfigInput) {
  const session = await requireActiveSession(currentSession);
  const privacyRepository = getPrivacyRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const previousConfig = await findOrCreatePrivacyConfig(session.user.id);
    const previousAuditMetadata = {
      keyVersion: previousConfig.keyVersion,
      storageMode: previousConfig.storageMode,
    };
    const updatedAt = nowIso();
    const updatedConfig = await privacyRepository.updateConfig(session.user.id, {
      cipherAlgorithm: input.payload.cipherAlgorithm,
      e2eeEnabled: input.payload.e2eeEnabled,
      keyVersion: input.payload.keyVersion,
      recoveryEnabled: input.payload.recoveryEnabled,
      storageMode: input.payload.storageMode,
      updatedAt,
    });

    if (!updatedConfig) {
      throwPrivacyConfigNotFound();
    }

    await appendAuditLog({
      action: "privacy_config.update",
      deviceId: session.device.id,
      metadata: {
        cipherAlgorithm: updatedConfig.cipherAlgorithm,
        keyVersion: updatedConfig.keyVersion,
        previousKeyVersion: previousAuditMetadata.keyVersion,
        previousStorageMode: previousAuditMetadata.storageMode,
        storageMode: updatedConfig.storageMode,
      },
      resourceId: updatedConfig.userId,
      resourceType: "privacy_config",
      userId: session.user.id,
    });
    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: updatedConfig.userId,
      entityType: "privacy_config",
      operation: "update",
      userId: session.user.id,
    });

    return {
      config: toPublicPrivacyConfig(updatedConfig),
    };
  });
}

/**
 * 保存端到端加密条目。
 *
 * 同一用户下 `(entityType, entityId)` 唯一。首次保存会创建条目，后续保存会覆盖密文
 * 元数据和正文；两种路径都会写同步日志，便于其他设备拉取最新密文。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 保存 vault item DTO。
 * @returns 保存后的密文条目和本次操作类型。
 */
export async function saveVaultItem(currentSession: CurrentSession, input: SaveVaultItemInput) {
  const session = await requireActiveSession(currentSession);
  const privacyRepository = getPrivacyRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const timestamp = nowIso();
    const existingItem = await privacyRepository.findVaultItemByEntity(
      session.user.id,
      input.payload.entityType,
      input.payload.entityId,
    );
    const item = existingItem
      ? await privacyRepository.updateVaultItem(session.user.id, existingItem.id, {
        aad: input.payload.aad ?? null,
        algorithm: input.payload.algorithm,
        ciphertext: input.payload.ciphertext,
        contentHash: input.payload.contentHash,
        keyVersion: input.payload.keyVersion,
        nonce: input.payload.nonce,
        updatedAt: timestamp,
      })
      : await privacyRepository.createVaultItem({
        aad: input.payload.aad ?? null,
        algorithm: input.payload.algorithm,
        ciphertext: input.payload.ciphertext,
        contentHash: input.payload.contentHash,
        createdAt: timestamp,
        entityId: input.payload.entityId,
        entityType: input.payload.entityType,
        id: randomUUID(),
        keyVersion: input.payload.keyVersion,
        nonce: input.payload.nonce,
        updatedAt: timestamp,
        userId: session.user.id,
      });

    if (!item) {
      throwVaultItemNotFound();
    }

    const operation = existingItem ? "update" : "create";

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: item.id,
      entityType: "vault_item",
      operation,
      userId: session.user.id,
    });

    return {
      item: toPublicVaultItem(item),
      operation,
    };
  });
}

/**
 * 分页拉取当前用户端到端加密条目。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 分页与过滤查询。
 * @returns 当前页密文条目和下一页游标。
 */
export async function listVaultItems(currentSession: CurrentSession, query: ListVaultItemsQuery) {
  const session = await requireActiveSession(currentSession);
  const page = await getPrivacyRepository().listVaultItems(session.user.id, query);

  return {
    items: page.items.map(toPublicVaultItem),
    nextCursor: page.nextCursor,
  };
}

/**
 * 查找或创建当前用户隐私配置。
 *
 * @param userId 用户 ID。
 * @returns 用户隐私配置。
 */
async function findOrCreatePrivacyConfig(userId: string): Promise<PrivacyConfigRecord> {
  const privacyRepository = getPrivacyRepository();
  const existingConfig = await privacyRepository.findConfig(userId);

  if (existingConfig) {
    return existingConfig;
  }

  const timestamp = nowIso();

  return privacyRepository.createDefaultConfig({
    createdAt: timestamp,
    updatedAt: timestamp,
    userId,
  });
}

/**
 * 转换为前端可见的隐私配置。
 *
 * @param config 隐私配置记录。
 * @returns 不包含任何密钥材料的公开配置。
 */
function toPublicPrivacyConfig(config: PrivacyConfigRecord): PublicPrivacyConfig {
  return {
    cipherAlgorithm: config.cipherAlgorithm,
    createdAt: config.createdAt,
    e2eeEnabled: config.e2eeEnabled,
    keyVersion: config.keyVersion,
    recoveryEnabled: config.recoveryEnabled,
    storageMode: config.storageMode,
    updatedAt: config.updatedAt,
    userId: config.userId,
  };
}

/**
 * 转换为前端可见的密文条目。
 *
 * @param item vault item 记录。
 * @returns 端到端密文条目和加密元数据。
 */
function toPublicVaultItem(item: EncryptedVaultItemRecord): PublicVaultItem {
  return {
    aad: item.aad,
    algorithm: item.algorithm,
    ciphertext: item.ciphertext,
    contentHash: item.contentHash,
    createdAt: item.createdAt,
    entityId: item.entityId,
    entityType: item.entityType,
    id: item.id,
    keyVersion: item.keyVersion,
    nonce: item.nonce,
    updatedAt: item.updatedAt,
  };
}

/**
 * 抛出隐私配置不存在错误。
 */
function throwPrivacyConfigNotFound(): never {
  throw new AppError({
    code: ERROR_CODES.PRIVACY_CONFIG_NOT_FOUND,
    message: "隐私配置不存在",
    statusCode: 404,
  });
}

/**
 * 抛出端到端加密条目不存在错误。
 */
function throwVaultItemNotFound(): never {
  throw new AppError({
    code: ERROR_CODES.VAULT_ITEM_NOT_FOUND,
    message: "端到端加密条目不存在或已删除",
    statusCode: 404,
  });
}
