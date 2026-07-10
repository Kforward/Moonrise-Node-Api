import type { CurrentSession } from "../../common/types/current-session";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import type { SyncChangeLogRecord, SyncEntityType, SyncOperation } from "../../infrastructure/database/memory-store";
import { updateAppPreferencesSchema } from "../app/app.dto";
import { updateCurrentAppPreferences } from "../app/app.service";
import { requireActiveSession } from "../auth/auth.service";
import {
  createPeriodRecordSchema,
  deletePeriodRecordSchema,
  finishPeriodRecordSchema,
  updateCycleSettingsSchema,
  updatePeriodRecordSchema,
} from "../cycle/cycle.dto";
import {
  createPeriodRecord,
  deletePeriodRecord,
  finishPeriodRecord,
  updateCycleSettings,
  updatePeriodRecord,
} from "../cycle/cycle.service";
import { saveVaultItemSchema, updatePrivacyConfigSchema } from "../privacy/privacy.dto";
import { saveVaultItem, updatePrivacyConfig } from "../privacy/privacy.service";
import { updateUserProfileSchema } from "../users/users.dto";
import { updateCurrentUserProfile } from "../users/users.service";
import type { ListSyncChangesQuery, SyncPushChangeInput, SyncPushInput } from "./sync.dto";
import { getSyncRepository } from "./sync.repository";

/**
 * 同步变更日志写入参数。
 *
 * 业务写接口通过该结构描述被修改的实体，当前内存实现会生成递增同步版本和校验摘要。
 */
export interface AppendSyncChangeInput {
  /** 变更所属用户 ID。 */
  userId: string;
  /** 被修改的实体类型。 */
  entityType: SyncEntityType;
  /** 被修改的实体 ID。 */
  entityId: string;
  /** 本次同步变更的操作类型。 */
  operation: SyncOperation;
  /** 实体自身版本；当前无实体级版本时允许为空。 */
  entityVersion?: number | null;
  /** 前端生成的幂等变更 ID，用于排查和后续去重。 */
  clientMutationId?: string | null;
}

interface SyncPushChangeSuccessResult {
  clientMutationId: string;
  entityType: string;
  operation: string;
  success: true;
  data: unknown;
}

interface SyncPushChangeFailedResult {
  clientMutationId: string;
  entityType: string;
  operation: string;
  success: false;
  error: {
    code: string;
    message: string;
    data: unknown;
  };
}

type SyncPushChangeResult = SyncPushChangeSuccessResult | SyncPushChangeFailedResult;

/**
 * 写入同步变更日志。
 *
 * 所有影响前端跨设备同步的结构化实体写入，都应通过该函数生成同步日志。
 *
 * @param input 同步变更输入。
 * @returns 已写入的同步变更日志。
 */
export async function appendSyncChange(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  const createdAt = nowIso();
  const syncRepository = getSyncRepository();

  return syncRepository.appendChange({
    checksum: buildChangeChecksum(input, createdAt),
    clientMutationId: input.clientMutationId ?? null,
    createdAt,
    entityId: input.entityId,
    entityType: input.entityType,
    entityVersion: input.entityVersion ?? null,
    operation: input.operation,
    userId: input.userId,
  });
}

/**
 * 写入同步变更日志。
 *
 * PostgreSQL 模式写入 `sync_change_logs`，内存模式保留现有数组实现。该函数用于已经
 * 迁移到异步 repository 的业务写操作。
 *
 * @param input 同步变更输入。
 * @returns 已写入的同步变更日志。
 */
export async function appendSyncChangeAsync(input: AppendSyncChangeInput): Promise<SyncChangeLogRecord> {
  return appendSyncChange(input);
}

/**
 * 拉取当前用户的增量同步变更。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 增量查询参数。
 * @returns 增量同步变更列表和下一次拉取游标。
 */
export async function listSyncChanges(currentSession: CurrentSession, query: ListSyncChangesQuery) {
  const session = await requireActiveSession(currentSession);

  return getSyncRepository().listChanges(session.user.id, query);
}

/**
 * 获取当前用户同步水位。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户最新同步版本号。
 */
export async function getSyncState(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const latestVersion = await getSyncRepository().getLatestVersion(session.user.id);

  return {
    latestVersion,
  };
}

/**
 * 批量处理前端离线变更。
 *
 * 该函数逐条分发到现有业务 service，复用各模块已经实现的 DTO 校验、归属校验、幂等
 * 快照和同步日志写入。单条变更失败不会阻断后续变更，前端可以根据 `results` 引导用户
 * 处理冲突或重试失败项。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 批量离线变更输入。
 * @returns 每条变更的处理结果和处理后的同步水位。
 */
export async function pushSyncChanges(currentSession: CurrentSession, input: SyncPushInput) {
  const session = await requireActiveSession(currentSession);
  const results: SyncPushChangeResult[] = [];

  for (const change of input.changes) {
    results.push(await applySyncPushChange({
      deviceId: session.device.id,
      userId: session.user.id,
    }, change));
  }

  const latestVersion = await getSyncRepository().getLatestVersion(session.user.id);

  return {
    failedCount: results.filter(result => !result.success).length,
    latestVersion,
    results,
    successCount: results.filter(result => result.success).length,
  };
}

/**
 * 处理单条离线变更并转为批量结果。
 *
 * @param currentSession 当前用户与设备定位信息。
 * @param change 单条离线变更。
 * @returns 单条成功或失败结果。
 */
async function applySyncPushChange(
  currentSession: CurrentSession,
  change: SyncPushChangeInput,
): Promise<SyncPushChangeResult> {
  try {
    return {
      clientMutationId: change.clientMutationId,
      data: await dispatchSyncPushChange(currentSession, change),
      entityType: change.entityType,
      operation: change.operation,
      success: true,
    };
  } catch (error) {
    if (!(error instanceof AppError)) {
      throw error;
    }

    return {
      clientMutationId: change.clientMutationId,
      entityType: change.entityType,
      error: toSyncPushError(error),
      operation: change.operation,
      success: false,
    };
  }
}

/**
 * 按实体类型和操作类型分发离线变更。
 *
 * @param currentSession 当前用户与设备定位信息。
 * @param change 单条离线变更。
 * @returns 对应业务 service 的响应数据。
 */
async function dispatchSyncPushChange(currentSession: CurrentSession, change: SyncPushChangeInput): Promise<unknown> {
  if (change.entityType === "user_profile" && change.operation === "update") {
    return updateCurrentUserProfile(currentSession, validateWithZod(updateUserProfileSchema, buildMutationInput(change)));
  }

  if (change.entityType === "user_app_preferences" && change.operation === "update") {
    return updateCurrentAppPreferences(currentSession, validateWithZod(updateAppPreferencesSchema, buildMutationInput(change)));
  }

  if (change.entityType === "cycle_settings" && change.operation === "update") {
    return updateCycleSettings(currentSession, validateWithZod(updateCycleSettingsSchema, buildMutationInput(change)));
  }

  if (change.entityType === "privacy_config" && change.operation === "update") {
    return updatePrivacyConfig(currentSession, validateWithZod(updatePrivacyConfigSchema, buildMutationInput(change)));
  }

  if (change.entityType === "vault_item" && (change.operation === "create" || change.operation === "update")) {
    return saveVaultItem(currentSession, validateWithZod(saveVaultItemSchema, buildMutationInput(change)));
  }

  if (change.entityType === "period_record") {
    return dispatchPeriodRecordPushChange(currentSession, change);
  }

  throwUnsupportedSyncPushChange(`暂不支持的离线变更：${change.entityType}.${change.operation}`);
}

/**
 * 分发经期记录离线变更。
 *
 * @param currentSession 当前用户与设备定位信息。
 * @param change 单条经期记录离线变更。
 * @returns 经期记录业务 service 的响应数据。
 */
async function dispatchPeriodRecordPushChange(currentSession: CurrentSession, change: SyncPushChangeInput): Promise<unknown> {
  const mutationInput = buildMutationInput(change);

  if (change.operation === "create") {
    return createPeriodRecord(currentSession, validateWithZod(createPeriodRecordSchema, mutationInput));
  }

  if (change.operation === "update") {
    return updatePeriodRecord(currentSession, validateWithZod(updatePeriodRecordSchema, mutationInput));
  }

  if (change.operation === "delete") {
    return deletePeriodRecord(currentSession, validateWithZod(deletePeriodRecordSchema, mutationInput));
  }

  if (change.operation === "finish") {
    return finishPeriodRecord(currentSession, validateWithZod(finishPeriodRecordSchema, mutationInput));
  }

  throwUnsupportedSyncPushChange(`暂不支持的经期记录离线操作：${change.operation}`);
}

/**
 * 将批量变更项转换为业务写接口 DTO 形状。
 *
 * @param change 单条离线变更。
 * @returns 业务 service 可接收的 `clientMutationId + payload` 结构。
 */
function buildMutationInput(change: SyncPushChangeInput): { clientMutationId: string; payload: unknown } {
  return {
    clientMutationId: change.clientMutationId,
    payload: change.payload,
  };
}

/**
 * 转换单条离线变更错误。
 *
 * @param error 捕获到的业务异常或未知异常。
 * @returns 前端可识别的单条失败信息。
 */
function toSyncPushError(error: AppError): SyncPushChangeFailedResult["error"] {
  return {
    code: error.code,
    data: error.data,
    message: error.message,
  };
}

/**
 * 抛出离线变更暂不支持错误。
 *
 * @param message 面向前端和调试日志的错误说明。
 */
function throwUnsupportedSyncPushChange(message: string): never {
  throw new AppError({
    code: ERROR_CODES.NOT_IMPLEMENTED,
    message,
    statusCode: 400,
  });
}

/**
 * 构造同步变更校验摘要。
 *
 * @param input 同步变更输入。
 * @param createdAt 变更创建时间。
 * @returns 用于同步日志完整性校验的 SHA-256 摘要。
 */
function buildChangeChecksum(input: AppendSyncChangeInput, createdAt: string): string {
  return sha256([
    input.userId,
    input.entityType,
    input.entityId,
    input.operation,
    input.entityVersion ?? "none",
    input.clientMutationId ?? "none",
    createdAt,
  ].join(":"));
}
