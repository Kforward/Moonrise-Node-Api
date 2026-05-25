import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { memoryStore, type PeriodRecord } from "../../infrastructure/database/memory-store";
import { requireActiveSession } from "../auth/auth.service";
import type {
  CreatePeriodRecordInput,
  DeletePeriodRecordInput,
  FinishPeriodRecordInput,
  ListPeriodRecordsQuery,
  UpdateCycleSettingsInput,
  UpdatePeriodRecordInput,
} from "./cycle.dto";

interface PeriodRecordDraft {
  id?: string;
  startDate: string;
  endDate: string | null;
}

/**
 * 获取当前用户周期设置。
 *
 * @param currentSession 当前用户与设备会话。
 */
export function getCycleSettings(currentSession: CurrentSession) {
  const session = requireActiveSession(currentSession);
  const settings = memoryStore.cycleSettings.get(session.user.id);

  return {
    settings,
  };
}

/**
 * 更新当前用户周期设置。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 周期设置更新 DTO。
 */
export function updateCycleSettings(currentSession: CurrentSession, input: UpdateCycleSettingsInput) {
  const session = requireActiveSession(currentSession);
  const settings = memoryStore.cycleSettings.get(session.user.id);

  if (!settings) {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "周期设置未初始化",
      statusCode: 500,
    });
  }

  const result = replayOrRunMutation(session.user.id, input.clientMutationId, () => {
    settings.avgCycleLength = input.payload.avgCycleLength;
    settings.avgPeriodLength = input.payload.avgPeriodLength;
    settings.clientUpdatedAt = input.payload.clientUpdatedAt ?? null;
    settings.reminderDaysAhead = input.payload.reminderDaysAhead;
    settings.reminderEnabled = input.payload.reminderEnabled;
    settings.reminderTime = input.payload.reminderTime;
    settings.updatedAt = nowIso();

    return {
      settings,
    };
  });

  return result;
}

/**
 * 分页列出当前用户经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param query 分页查询参数。
 */
export function listPeriodRecords(currentSession: CurrentSession, query: ListPeriodRecordsQuery) {
  const session = requireActiveSession(currentSession);
  const sortedRecords = [...memoryStore.periodRecords.values()]
    .filter(record => record.userId === session.user.id && !record.deletedAt)
    .sort(sortPeriodRecordsByCreatedAtDesc);
  const startIndex = query.cursor ? sortedRecords.findIndex(record => record.id === query.cursor) + 1 : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const items = sortedRecords.slice(safeStartIndex, safeStartIndex + query.limit);
  const nextRecord = sortedRecords[safeStartIndex + query.limit];

  return {
    items,
    nextCursor: nextRecord?.id ?? null,
  };
}

/**
 * 新增经期记录。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 新增记录 DTO。
 */
export function createPeriodRecord(currentSession: CurrentSession, input: CreatePeriodRecordInput) {
  const session = requireActiveSession(currentSession);

  return replayOrRunMutation(session.user.id, input.clientMutationId, () => {
    const draft = {
      endDate: input.payload.endDate ?? null,
      startDate: input.payload.startDate,
    };
    assertValidDateRange(draft);
    assertNoOverlappedRecord(session.user.id, draft);

    const timestamp = nowIso();
    const record: PeriodRecord = {
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
    };

    memoryStore.periodRecords.set(record.id, record);

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
 */
export function updatePeriodRecord(currentSession: CurrentSession, input: UpdatePeriodRecordInput) {
  const session = requireActiveSession(currentSession);

  return replayOrRunMutation(session.user.id, input.clientMutationId, () => {
    const record = findOwnedActiveRecord(session.user.id, input.payload.id);
    const draft = {
      endDate: input.payload.endDate !== undefined ? input.payload.endDate : record.endDate,
      id: record.id,
      startDate: input.payload.startDate ?? record.startDate,
    };
    assertValidDateRange(draft);
    assertNoOverlappedRecord(session.user.id, draft);

    record.startDate = draft.startDate;
    record.endDate = draft.endDate;
    record.intensity = input.payload.intensity ?? record.intensity;
    record.painLevel = input.payload.painLevel ?? record.painLevel;
    record.moods = input.payload.moods ?? record.moods;
    record.notesCiphertext = input.payload.notesCiphertext !== undefined
      ? input.payload.notesCiphertext
      : record.notesCiphertext;
    record.clientUpdatedAt = input.payload.clientUpdatedAt ?? record.clientUpdatedAt;
    record.updatedAt = nowIso();
    record.version += 1;

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
 */
export function deletePeriodRecord(currentSession: CurrentSession, input: DeletePeriodRecordInput) {
  const session = requireActiveSession(currentSession);

  return replayOrRunMutation(session.user.id, input.clientMutationId, () => {
    const record = findOwnedActiveRecord(session.user.id, input.payload.id);

    record.deletedAt = nowIso();
    record.updatedAt = record.deletedAt;
    record.version += 1;

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
 */
export function finishPeriodRecord(currentSession: CurrentSession, input: FinishPeriodRecordInput) {
  const session = requireActiveSession(currentSession);

  return replayOrRunMutation(session.user.id, input.clientMutationId, () => {
    const record = findOwnedActiveRecord(session.user.id, input.payload.id);
    const draft = {
      endDate: input.payload.endDate,
      id: record.id,
      startDate: record.startDate,
    };
    assertValidDateRange(draft);
    assertNoOverlappedRecord(session.user.id, draft);

    record.endDate = input.payload.endDate;
    record.clientUpdatedAt = input.payload.clientUpdatedAt ?? record.clientUpdatedAt;
    record.updatedAt = nowIso();
    record.version += 1;

    return {
      record,
    };
  });
}

/**
 * 处理客户端幂等写入。
 *
 * 当前实现保存首次响应并在重复提交时原样返回；后续 PostgreSQL 实现应使用
 * `sync_change_logs(user_id, client_mutation_id)` 唯一约束保证并发安全。
 *
 * @param userId 用户 ID。
 * @param clientMutationId 客户端幂等键。
 * @param run 首次提交时执行的写入逻辑。
 */
function replayOrRunMutation<TResponse>(userId: string, clientMutationId: string, run: () => TResponse): TResponse {
  const mutationKey = `${userId}:${clientMutationId}`;
  const existingMutation = memoryStore.mutations.get(mutationKey);

  if (existingMutation) {
    return existingMutation.response as TResponse;
  }

  const response = run();
  memoryStore.mutations.set(mutationKey, {
    clientMutationId,
    createdAt: nowIso(),
    response,
    userId,
  });

  return response;
}

/**
 * 校验日期区间合法性。
 *
 * @param draft 待校验的日期区间。
 */
function assertValidDateRange(draft: PeriodRecordDraft): void {
  if (draft.endDate && draft.endDate < draft.startDate) {
    throw new AppError({
      code: ERROR_CODES.VALIDATION_FAILED,
      message: "结束日期不能早于开始日期",
      statusCode: 400,
    });
  }
}

/**
 * 校验同一用户下经期记录是否重叠。
 *
 * @param userId 用户 ID。
 * @param draft 待写入的日期区间。
 */
function assertNoOverlappedRecord(userId: string, draft: PeriodRecordDraft): void {
  const draftStart = draft.startDate;
  const draftEnd = draft.endDate ?? draft.startDate;
  const conflict = [...memoryStore.periodRecords.values()].find(record => {
    if (record.userId !== userId || record.deletedAt || record.id === draft.id) {
      return false;
    }

    const recordStart = record.startDate;
    const recordEnd = record.endDate ?? record.startDate;

    return draftStart <= recordEnd && recordStart <= draftEnd;
  });

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
 * 查找当前用户拥有的有效经期记录。
 *
 * @param userId 用户 ID。
 * @param recordId 经期记录 ID。
 */
function findOwnedActiveRecord(userId: string, recordId: string): PeriodRecord {
  const record = memoryStore.periodRecords.get(recordId);

  if (!record || record.userId !== userId || record.deletedAt) {
    throw new AppError({
      code: ERROR_CODES.CYCLE_RECORD_NOT_FOUND,
      message: "经期记录不存在或已删除",
      statusCode: 404,
    });
  }

  return record;
}

/**
 * 按创建时间倒序排列经期记录。
 *
 * @param left 左侧记录。
 * @param right 右侧记录。
 */
function sortPeriodRecordsByCreatedAtDesc(left: PeriodRecord, right: PeriodRecord): number {
  return right.createdAt.localeCompare(left.createdAt);
}
