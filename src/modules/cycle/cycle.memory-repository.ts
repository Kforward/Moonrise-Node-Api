import {
  memoryStore,
  type CycleSettingsRecord,
  type PeriodRecord,
} from "../../infrastructure/database/memory-store";
import type {
  CycleRepository,
  DeletePeriodRecordData,
  ListPeriodRecordsOptions,
  PeriodRecordDateRange,
  PeriodRecordsPage,
  UpdateCycleSettingsData,
  UpdatePeriodRecordData,
} from "./cycle.repository";

/**
 * 内存版周期仓储。
 *
 * 该实现保留开发期本地联调行为，便于没有 PostgreSQL 的前端环境继续运行完整周期流程。
 */
export const memoryCycleRepository: CycleRepository = {
  /**
   * 获取内存中的周期设置。
   *
   * @param userId 用户 ID。
   * @returns 周期设置；不存在时返回 `null`。
   */
  async getSettings(userId: string): Promise<CycleSettingsRecord | null> {
    return memoryStore.cycleSettings.get(userId) ?? null;
  },

  /**
   * 更新内存中的周期设置。
   *
   * @param userId 用户 ID。
   * @param data 周期设置更新字段。
   * @returns 更新后的周期设置；不存在时返回 `null`。
   */
  async updateSettings(userId: string, data: UpdateCycleSettingsData): Promise<CycleSettingsRecord | null> {
    const settings = memoryStore.cycleSettings.get(userId);

    if (!settings) {
      return null;
    }

    settings.avgCycleLength = data.avgCycleLength;
    settings.avgPeriodLength = data.avgPeriodLength;
    settings.clientUpdatedAt = data.clientUpdatedAt;
    settings.reminderDaysAhead = data.reminderDaysAhead;
    settings.reminderEnabled = data.reminderEnabled;
    settings.reminderTime = data.reminderTime;
    settings.updatedAt = data.updatedAt;

    return settings;
  },

  /**
   * 分页列出内存中的有效经期记录。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页记录和下一页游标。
   */
  async listPeriodRecords(userId: string, options: ListPeriodRecordsOptions): Promise<PeriodRecordsPage> {
    const sortedRecords = [...memoryStore.periodRecords.values()]
      .filter(record => record.userId === userId && !record.deletedAt)
      .sort(sortPeriodRecordsByCreatedAtDesc);

    return slicePeriodRecordsPage(sortedRecords, options);
  },

  /**
   * 查找内存中的有效经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @returns 有效经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async findActivePeriodRecord(userId: string, recordId: string): Promise<PeriodRecord | null> {
    const record = memoryStore.periodRecords.get(recordId);

    if (!record || record.userId !== userId || record.deletedAt) {
      return null;
    }

    return record;
  },

  /**
   * 查找内存中与候选日期区间重叠的经期记录。
   *
   * @param userId 用户 ID。
   * @param range 待写入或待更新的日期区间。
   * @returns 第一条冲突记录；没有冲突时返回 `null`。
   */
  async findOverlappedPeriodRecord(userId: string, range: PeriodRecordDateRange): Promise<PeriodRecord | null> {
    return [...memoryStore.periodRecords.values()].find(record => {
      if (record.userId !== userId || record.deletedAt || record.id === range.id) {
        return false;
      }

      return isDateRangeOverlapped(record, range);
    }) ?? null;
  },

  /**
   * 创建内存经期记录。
   *
   * @param record service 层生成的完整经期记录。
   * @returns 已写入的经期记录。
   */
  async createPeriodRecord(record: PeriodRecord): Promise<PeriodRecord> {
    memoryStore.periodRecords.set(record.id, record);

    return record;
  },

  /**
   * 更新内存经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 经期记录更新字段。
   * @returns 更新后的经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async updatePeriodRecord(userId: string, recordId: string, data: UpdatePeriodRecordData): Promise<PeriodRecord | null> {
    const record = await this.findActivePeriodRecord(userId, recordId);

    if (!record) {
      return null;
    }

    applyPeriodRecordPatch(record, data);

    return record;
  },

  /**
   * 软删除内存经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 软删除字段。
   * @returns 删除后的经期记录；不存在、已删除或不属于用户时返回 `null`。
   */
  async softDeletePeriodRecord(userId: string, recordId: string, data: DeletePeriodRecordData): Promise<PeriodRecord | null> {
    const record = await this.findActivePeriodRecord(userId, recordId);

    if (!record) {
      return null;
    }

    record.deletedAt = data.deletedAt;
    record.updatedAt = data.updatedAt;
    record.version = data.version;

    return record;
  },
};

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
 * 将经期记录更新字段应用到内存记录。
 *
 * @param record 当前经期记录。
 * @param data 经期记录更新字段。
 */
function applyPeriodRecordPatch(record: PeriodRecord, data: UpdatePeriodRecordData): void {
  if (data.startDate !== undefined) {
    record.startDate = data.startDate;
  }
  if (data.endDate !== undefined) {
    record.endDate = data.endDate;
  }
  if (data.intensity !== undefined) {
    record.intensity = data.intensity;
  }
  if (data.painLevel !== undefined) {
    record.painLevel = data.painLevel;
  }
  if (data.moods !== undefined) {
    record.moods = data.moods;
  }
  if (data.notesCiphertext !== undefined) {
    record.notesCiphertext = data.notesCiphertext;
  }
  if (data.clientUpdatedAt !== undefined) {
    record.clientUpdatedAt = data.clientUpdatedAt;
  }

  record.updatedAt = data.updatedAt;
  record.version = data.version;
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
 * 按创建时间倒序排列经期记录。
 *
 * @param left 左侧记录。
 * @param right 右侧记录。
 * @returns 排序比较结果。
 */
function sortPeriodRecordsByCreatedAtDesc(left: PeriodRecord, right: PeriodRecord): number {
  return right.createdAt.localeCompare(left.createdAt);
}
