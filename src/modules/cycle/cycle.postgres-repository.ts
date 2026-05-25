import { and, desc, eq, isNull } from "drizzle-orm";
import type { CycleSettingsRecord, PeriodRecord } from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { cycleSettings, periodRecords } from "../../infrastructure/database/schema";
import type {
  CycleRepository,
  DeletePeriodRecordData,
  ListPeriodRecordsOptions,
  PeriodRecordDateRange,
  PeriodRecordsPage,
  UpdateCycleSettingsData,
  UpdatePeriodRecordData,
} from "./cycle.repository";

type CycleSettingsRow = typeof cycleSettings.$inferSelect;
type CycleSettingsInsert = typeof cycleSettings.$inferInsert;
type PeriodRecordRow = typeof periodRecords.$inferSelect;
type PeriodRecordInsert = typeof periodRecords.$inferInsert;

/**
 * PostgreSQL 版周期仓储。
 *
 * 该实现承接周期设置和经期记录的持久化读写，service 层无需关心底层数据源是内存还是数据库。
 */
export const postgresCycleRepository: CycleRepository = {
  /**
   * 从 PostgreSQL 获取周期设置。
   *
   * @param userId 用户 ID。
   * @returns 周期设置；不存在时返回 `null`。
   */
  async getSettings(userId: string): Promise<CycleSettingsRecord | null> {
    const [settings] = await getDatabase()
      .select()
      .from(cycleSettings)
      .where(eq(cycleSettings.userId, userId))
      .limit(1);

    return settings ? toCycleSettingsRecord(settings) : null;
  },

  /**
   * 在 PostgreSQL 中更新周期设置。
   *
   * @param userId 用户 ID。
   * @param data 周期设置更新字段。
   * @returns 更新后的周期设置；不存在时返回 `null`。
   */
  async updateSettings(userId: string, data: UpdateCycleSettingsData): Promise<CycleSettingsRecord | null> {
    const [settings] = await getDatabase()
      .update(cycleSettings)
      .set(buildCycleSettingsPatch(data))
      .where(eq(cycleSettings.userId, userId))
      .returning();

    return settings ? toCycleSettingsRecord(settings) : null;
  },

  /**
   * 从 PostgreSQL 分页列出有效经期记录。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页记录和下一页游标。
   */
  async listPeriodRecords(userId: string, options: ListPeriodRecordsOptions): Promise<PeriodRecordsPage> {
    const records = await getDatabase()
      .select()
      .from(periodRecords)
      .where(and(
        eq(periodRecords.userId, userId),
        isNull(periodRecords.deletedAt),
      ))
      .orderBy(desc(periodRecords.createdAt));
    const mappedRecords = records.map(toPeriodRecord);

    return slicePeriodRecordsPage(mappedRecords, options);
  },

  /**
   * 从 PostgreSQL 查找有效经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @returns 有效经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async findActivePeriodRecord(userId: string, recordId: string): Promise<PeriodRecord | null> {
    const [record] = await getDatabase()
      .select()
      .from(periodRecords)
      .where(and(
        eq(periodRecords.id, recordId),
        eq(periodRecords.userId, userId),
        isNull(periodRecords.deletedAt),
      ))
      .limit(1);

    return record ? toPeriodRecord(record) : null;
  },

  /**
   * 从 PostgreSQL 查找与候选日期区间重叠的经期记录。
   *
   * @param userId 用户 ID。
   * @param range 待写入或待更新的日期区间。
   * @returns 第一条冲突记录；没有冲突时返回 `null`。
   */
  async findOverlappedPeriodRecord(userId: string, range: PeriodRecordDateRange): Promise<PeriodRecord | null> {
    const records = await getDatabase()
      .select()
      .from(periodRecords)
      .where(and(
        eq(periodRecords.userId, userId),
        isNull(periodRecords.deletedAt),
      ))
      .orderBy(desc(periodRecords.createdAt));

    return records
      .map(toPeriodRecord)
      .find(record => record.id !== range.id && isDateRangeOverlapped(record, range)) ?? null;
  },

  /**
   * 在 PostgreSQL 中创建经期记录。
   *
   * @param record service 层生成的完整经期记录。
   * @returns 已写入的经期记录。
   */
  async createPeriodRecord(record: PeriodRecord): Promise<PeriodRecord> {
    const [createdRecord] = await getDatabase()
      .insert(periodRecords)
      .values(record)
      .returning();

    return toPeriodRecord(assertRow(createdRecord, "创建经期记录失败"));
  },

  /**
   * 在 PostgreSQL 中更新经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 经期记录更新字段。
   * @returns 更新后的经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async updatePeriodRecord(userId: string, recordId: string, data: UpdatePeriodRecordData): Promise<PeriodRecord | null> {
    const [record] = await getDatabase()
      .update(periodRecords)
      .set(buildPeriodRecordPatch(data))
      .where(and(
        eq(periodRecords.id, recordId),
        eq(periodRecords.userId, userId),
        isNull(periodRecords.deletedAt),
      ))
      .returning();

    return record ? toPeriodRecord(record) : null;
  },

  /**
   * 在 PostgreSQL 中软删除经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 软删除字段。
   * @returns 删除后的经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async softDeletePeriodRecord(userId: string, recordId: string, data: DeletePeriodRecordData): Promise<PeriodRecord | null> {
    const [record] = await getDatabase()
      .update(periodRecords)
      .set({
        deletedAt: data.deletedAt,
        updatedAt: data.updatedAt,
        version: data.version,
      })
      .where(and(
        eq(periodRecords.id, recordId),
        eq(periodRecords.userId, userId),
        isNull(periodRecords.deletedAt),
      ))
      .returning();

    return record ? toPeriodRecord(record) : null;
  },
};

/**
 * 构造周期设置数据库更新字段。
 *
 * @param data service 层整理后的周期设置更新数据。
 * @returns 可传给 Drizzle update 的周期设置字段。
 */
function buildCycleSettingsPatch(data: UpdateCycleSettingsData): Partial<CycleSettingsInsert> {
  return {
    avgCycleLength: data.avgCycleLength,
    avgPeriodLength: data.avgPeriodLength,
    clientUpdatedAt: data.clientUpdatedAt,
    reminderDaysAhead: data.reminderDaysAhead,
    reminderEnabled: data.reminderEnabled,
    reminderTime: data.reminderTime,
    updatedAt: data.updatedAt,
  };
}

/**
 * 构造经期记录数据库更新字段。
 *
 * @param data service 层整理后的经期记录更新数据。
 * @returns 可传给 Drizzle update 的经期记录字段。
 */
function buildPeriodRecordPatch(data: UpdatePeriodRecordData): Partial<PeriodRecordInsert> {
  const patch: Partial<PeriodRecordInsert> = {
    updatedAt: data.updatedAt,
    version: data.version,
  };

  if (data.startDate !== undefined) {
    patch.startDate = data.startDate;
  }
  if (data.endDate !== undefined) {
    patch.endDate = data.endDate;
  }
  if (data.intensity !== undefined) {
    patch.intensity = data.intensity;
  }
  if (data.painLevel !== undefined) {
    patch.painLevel = data.painLevel;
  }
  if (data.moods !== undefined) {
    patch.moods = data.moods;
  }
  if (data.notesCiphertext !== undefined) {
    patch.notesCiphertext = data.notesCiphertext;
  }
  if (data.clientUpdatedAt !== undefined) {
    patch.clientUpdatedAt = data.clientUpdatedAt;
  }

  return patch;
}

/**
 * 按游标切分经期记录页。
 *
 * @param sortedRecords 已按创建时间倒序排列的经期记录。
 * @param options 分页参数。
 * @returns 当前页记录和下一页游标。
 */
function slicePeriodRecordsPage(sortedRecords: PeriodRecord[], options: ListPeriodRecordsOptions): PeriodRecordsPage {
  const startIndex = options.cursor ? sortedRecords.findIndex(record => record.id === options.cursor) + 1 : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const items = sortedRecords.slice(safeStartIndex, safeStartIndex + options.limit);
  const nextRecord = sortedRecords[safeStartIndex + options.limit];

  return {
    items,
    nextCursor: nextRecord?.id ?? null,
  };
}

/**
 * 判断已有记录与候选日期区间是否重叠。
 *
 * @param record 已有经期记录。
 * @param range 候选日期区间。
 * @returns 两个日期区间是否存在交集。
 */
function isDateRangeOverlapped(record: PeriodRecord, range: PeriodRecordDateRange): boolean {
  const draftEnd = range.endDate ?? range.startDate;
  const recordEnd = record.endDate ?? record.startDate;

  return range.startDate <= recordEnd && record.startDate <= draftEnd;
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
 * 转换周期设置记录。
 *
 * @param row Drizzle 周期设置行。
 * @returns service 层使用的周期设置记录。
 */
function toCycleSettingsRecord(row: CycleSettingsRow): CycleSettingsRecord {
  return {
    avgCycleLength: row.avgCycleLength,
    avgPeriodLength: row.avgPeriodLength,
    clientUpdatedAt: row.clientUpdatedAt,
    createdAt: row.createdAt,
    reminderDaysAhead: row.reminderDaysAhead,
    reminderEnabled: row.reminderEnabled,
    reminderTime: normalizeReminderTime(row.reminderTime),
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

/**
 * 规范化数据库 time 字段为前端契约中的 `HH:mm`。
 *
 * PostgreSQL 可能返回 `HH:mm:ss`，这里裁剪秒级信息，保证 PostgreSQL 与内存仓储响应一致。
 *
 * @param reminderTime 数据库读取到的提醒时间。
 * @returns 前端接口约定的提醒时间。
 */
function normalizeReminderTime(reminderTime: string): string {
  return reminderTime.slice(0, 5);
}

/**
 * 转换经期记录。
 *
 * @param row Drizzle 经期记录行。
 * @returns service 层使用的经期记录。
 */
function toPeriodRecord(row: PeriodRecordRow): PeriodRecord {
  return {
    clientRecordId: row.clientRecordId,
    clientUpdatedAt: row.clientUpdatedAt,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    endDate: row.endDate,
    id: row.id,
    intensity: row.intensity as PeriodRecord["intensity"],
    moods: row.moods,
    notesCiphertext: row.notesCiphertext,
    painLevel: row.painLevel as PeriodRecord["painLevel"],
    startDate: row.startDate,
    updatedAt: row.updatedAt,
    userId: row.userId,
    version: row.version,
  };
}
