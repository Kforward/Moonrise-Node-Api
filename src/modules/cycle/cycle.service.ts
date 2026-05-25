import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import type { PeriodRecord } from "../../infrastructure/database/memory-store";
import { requireActiveSession } from "../auth/auth.service";
import { replayOrRunMutationAsync } from "../sync/idempotency.service";
import { appendSyncChangeAsync } from "../sync/sync-log.service";
import type {
  CreatePeriodRecordInput,
  DeletePeriodRecordInput,
  FinishPeriodRecordInput,
  ListPeriodRecordsQuery,
  UpdateCycleSettingsInput,
  UpdatePeriodRecordInput,
} from "./cycle.dto";
import {
  getCycleRepository,
  type CycleRepository,
  type PeriodRecordDateRange,
  type UpdateCycleSettingsData,
  type UpdatePeriodRecordData,
} from "./cycle.repository";

/**
 * 获取当前用户周期设置。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户周期设置响应。
 */
export async function getCycleSettings(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const settings = await getCycleRepository().getSettings(session.user.id);

  return {
    settings,
  };
}

/**
 * 更新当前用户周期设置。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 周期设置更新 DTO。
 * @returns 更新后的周期设置响应。
 */
export async function updateCycleSettings(currentSession: CurrentSession, input: UpdateCycleSettingsInput) {
  const session = await requireActiveSession(currentSession);
  const cycleRepository = getCycleRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const settings = await cycleRepository.updateSettings(session.user.id, buildCycleSettingsUpdateData(input, nowIso()));

    if (!settings) {
      throw new AppError({
        code: ERROR_CODES.INTERNAL_SERVER_ERROR,
        message: "周期设置未初始化",
        statusCode: 500,
      });
    }

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: session.user.id,
      entityType: "cycle_settings",
      operation: "update",
      userId: session.user.id,
    });

    return {
      settings,
    };
  });
}

/**
 * 分页列出当前用户经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 分页查询参数。
 * @returns 当前页经期记录和下一页游标。
 */
export async function listPeriodRecords(currentSession: CurrentSession, query: ListPeriodRecordsQuery) {
  const session = await requireActiveSession(currentSession);

  return getCycleRepository().listPeriodRecords(session.user.id, query);
}

/**
 * 新增经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 新增记录 DTO。
 * @returns 已创建的经期记录响应。
 */
export async function createPeriodRecord(currentSession: CurrentSession, input: CreatePeriodRecordInput) {
  const session = await requireActiveSession(currentSession);
  const cycleRepository = getCycleRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const draft = {
      endDate: input.payload.endDate ?? null,
      startDate: input.payload.startDate,
    };
    await assertWritableDateRange(cycleRepository, session.user.id, draft);

    const timestamp = nowIso();
    const record = await cycleRepository.createPeriodRecord({
      clientRecordId: input.payload.clientRecordId,
      clientUpdatedAt: input.payload.clientUpdatedAt ?? null,
      createdAt: timestamp,
      deletedAt: null,
      endDate: draft.endDate,
      id: randomUUID(),
      intensity: input.payload.intensity,
      moods: input.payload.moods,
      notesCiphertext: input.payload.notesCiphertext ?? null,
      painLevel: input.payload.painLevel,
      startDate: draft.startDate,
      updatedAt: timestamp,
      userId: session.user.id,
      version: 1,
    });

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: record.id,
      entityType: "period_record",
      entityVersion: record.version,
      operation: "create",
      userId: session.user.id,
    });

    return {
      record,
    };
  });
}

/**
 * 更新经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 更新记录 DTO。
 * @returns 更新后的经期记录响应。
 */
export async function updatePeriodRecord(currentSession: CurrentSession, input: UpdatePeriodRecordInput) {
  const session = await requireActiveSession(currentSession);
  const cycleRepository = getCycleRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const currentRecord = await requireOwnedActiveRecord(cycleRepository, session.user.id, input.payload.id);
    const draft = {
      endDate: input.payload.endDate !== undefined ? input.payload.endDate : currentRecord.endDate,
      id: currentRecord.id,
      startDate: input.payload.startDate ?? currentRecord.startDate,
    };
    await assertWritableDateRange(cycleRepository, session.user.id, draft);
    const updateData = buildPeriodRecordUpdateData(input, currentRecord, draft, nowIso());
    const record = await cycleRepository.updatePeriodRecord(session.user.id, currentRecord.id, updateData);

    if (!record) {
      throwRecordNotFound();
    }

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: record.id,
      entityType: "period_record",
      entityVersion: record.version,
      operation: "update",
      userId: session.user.id,
    });

    return {
      record,
    };
  });
}

/**
 * 软删除经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 删除记录 DTO。
 * @returns 被删除记录的 ID 和删除时间。
 */
export async function deletePeriodRecord(currentSession: CurrentSession, input: DeletePeriodRecordInput) {
  const session = await requireActiveSession(currentSession);
  const cycleRepository = getCycleRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const currentRecord = await requireOwnedActiveRecord(cycleRepository, session.user.id, input.payload.id);
    const deletedAt = nowIso();
    const record = await cycleRepository.softDeletePeriodRecord(session.user.id, currentRecord.id, {
      deletedAt,
      updatedAt: deletedAt,
      version: currentRecord.version + 1,
    });

    if (!record) {
      throwRecordNotFound();
    }

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: record.id,
      entityType: "period_record",
      entityVersion: record.version,
      operation: "delete",
      userId: session.user.id,
    });

    return {
      recordId: record.id,
      deletedAt: record.deletedAt,
    };
  });
}

/**
 * 完成正在进行中的经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 完成记录 DTO。
 * @returns 更新后的经期记录响应。
 */
export async function finishPeriodRecord(currentSession: CurrentSession, input: FinishPeriodRecordInput) {
  const session = await requireActiveSession(currentSession);
  const cycleRepository = getCycleRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const currentRecord = await requireOwnedActiveRecord(cycleRepository, session.user.id, input.payload.id);
    const draft = {
      endDate: input.payload.endDate,
      id: currentRecord.id,
      startDate: currentRecord.startDate,
    };
    await assertWritableDateRange(cycleRepository, session.user.id, draft);
    const record = await cycleRepository.updatePeriodRecord(session.user.id, currentRecord.id, {
      clientUpdatedAt: input.payload.clientUpdatedAt ?? currentRecord.clientUpdatedAt,
      endDate: input.payload.endDate,
      updatedAt: nowIso(),
      version: currentRecord.version + 1,
    });

    if (!record) {
      throwRecordNotFound();
    }

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: record.id,
      entityType: "period_record",
      entityVersion: record.version,
      operation: "update",
      userId: session.user.id,
    });

    return {
      record,
    };
  });
}

/**
 * 构造周期设置更新数据。
 *
 * 该函数只提取 DTO 中允许写入的周期设置字段，并统一补入服务端更新时间，避免
 * HTTP 请求字段直接穿透到仓储层。
 *
 * @param input 周期设置更新 DTO。
 * @param updatedAt 服务端生成的更新时间。
 * @returns 仓储可写入的周期设置更新数据。
 */
function buildCycleSettingsUpdateData(input: UpdateCycleSettingsInput, updatedAt: string): UpdateCycleSettingsData {
  return {
    avgCycleLength: input.payload.avgCycleLength,
    avgPeriodLength: input.payload.avgPeriodLength,
    clientUpdatedAt: input.payload.clientUpdatedAt ?? null,
    reminderDaysAhead: input.payload.reminderDaysAhead,
    reminderEnabled: input.payload.reminderEnabled,
    reminderTime: input.payload.reminderTime,
    updatedAt,
  };
}

/**
 * 构造经期记录更新数据。
 *
 * @param input 经期记录更新 DTO。
 * @param currentRecord 当前数据库中的经期记录。
 * @param dateRange 已完成默认值合并的日期区间。
 * @param updatedAt 服务端生成的更新时间。
 * @returns 仓储可写入的经期记录更新数据。
 */
function buildPeriodRecordUpdateData(
  input: UpdatePeriodRecordInput,
  currentRecord: PeriodRecord,
  dateRange: PeriodRecordDateRange,
  updatedAt: string,
): UpdatePeriodRecordData {
  return {
    clientUpdatedAt: input.payload.clientUpdatedAt ?? currentRecord.clientUpdatedAt,
    endDate: dateRange.endDate,
    intensity: input.payload.intensity ?? currentRecord.intensity,
    moods: input.payload.moods ?? currentRecord.moods,
    notesCiphertext: input.payload.notesCiphertext !== undefined
      ? input.payload.notesCiphertext
      : currentRecord.notesCiphertext,
    painLevel: input.payload.painLevel ?? currentRecord.painLevel,
    startDate: dateRange.startDate,
    updatedAt,
    version: currentRecord.version + 1,
  };
}

/**
 * 校验日期区间可写入。
 *
 * @param cycleRepository 周期仓储实现。
 * @param userId 用户 ID。
 * @param range 待校验的日期区间。
 */
async function assertWritableDateRange(
  cycleRepository: CycleRepository,
  userId: string,
  range: PeriodRecordDateRange,
): Promise<void> {
  assertValidDateRange(range);

  const conflict = await cycleRepository.findOverlappedPeriodRecord(userId, range);

  if (conflict) {
    throw new AppError({
      code: ERROR_CODES.CYCLE_RECORD_OVERLAPPED,
      data: {
        conflictRecordId: conflict.id,
        endDate: conflict.endDate,
        startDate: conflict.startDate,
      },
      message: "这段日期已存在记录，请换一个区间",
      statusCode: 409,
    });
  }
}

/**
 * 验证日期区间合法性。
 *
 * @param range 待校验的日期区间。
 */
function assertValidDateRange(range: PeriodRecordDateRange): void {
  if (range.endDate && range.endDate < range.startDate) {
    throw new AppError({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: "结束日期不能早于开始日期",
      statusCode: 400,
    });
  }
}

/**
 * 查找当前用户拥有的有效经期记录。
 *
 * @param cycleRepository 周期仓储实现。
 * @param userId 用户 ID。
 * @param recordId 经期记录 ID。
 * @returns 当前用户拥有的有效经期记录。
 */
async function requireOwnedActiveRecord(
  cycleRepository: CycleRepository,
  userId: string,
  recordId: string,
): Promise<PeriodRecord> {
  const record = await cycleRepository.findActivePeriodRecord(userId, recordId);

  if (!record) {
    throwRecordNotFound();
  }

  return record;
}

/**
 * 抛出经期记录不存在错误。
 */
function throwRecordNotFound(): never {
  throw new AppError({
    code: ERROR_CODES.CYCLE_RECORD_NOT_FOUND,
    message: "经期记录不存在或已删除",
    statusCode: 404,
  });
}
