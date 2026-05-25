import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type { CycleSettingsRecord, PeriodRecord } from "../../infrastructure/database/memory-store";
import { memoryCycleRepository } from "./cycle.memory-repository";
import { postgresCycleRepository } from "./cycle.postgres-repository";

export interface UpdateCycleSettingsData {
  /** 前端预测周期所使用的平均周期长度。 */
  avgCycleLength: number;
  /** 前端预测经期所使用的平均经期长度。 */
  avgPeriodLength: number;
  /** 前端最后修改时间；缺省或传入 `null` 时保存为空。 */
  clientUpdatedAt: string | null;
  /** 提醒提前天数。 */
  reminderDaysAhead: number;
  /** 是否启用周期提醒。 */
  reminderEnabled: boolean;
  /** 提醒时间，格式为 `HH:mm`。 */
  reminderTime: string;
  /** 服务端生成的更新时间。 */
  updatedAt: string;
}

export interface PeriodRecordDateRange {
  /** 更新已有记录时传入记录 ID，用于重叠校验时排除自身。 */
  id?: string;
  /** 经期开始日期，格式为 `YYYY-MM-DD`。 */
  startDate: string;
  /** 经期结束日期；为空时按开始日期作为单日记录参与校验。 */
  endDate: string | null;
}

export interface ListPeriodRecordsOptions {
  /** 当前页最后一条记录 ID；为空时从第一页开始。 */
  cursor?: string;
  /** 本次最多返回的记录数量。 */
  limit: number;
}

export interface PeriodRecordsPage {
  /** 当前页经期记录。 */
  items: PeriodRecord[];
  /** 下一页游标；没有更多数据时返回 `null`。 */
  nextCursor: string | null;
}

export interface UpdatePeriodRecordData {
  /** 新的开始日期；传入 `undefined` 时表示不修改该字段。 */
  startDate?: string;
  /** 新的结束日期；传入 `undefined` 时表示不修改该字段。 */
  endDate?: string | null;
  /** 新的流量强度枚举。 */
  intensity?: PeriodRecord["intensity"];
  /** 新的疼痛等级枚举。 */
  painLevel?: PeriodRecord["painLevel"];
  /** 新的心情标签列表。 */
  moods?: string[];
  /** 新的备注密文；允许传入 `null` 清空备注。 */
  notesCiphertext?: string | null;
  /** 前端最后修改时间；缺省时由 service 层沿用旧值。 */
  clientUpdatedAt?: string | null;
  /** 服务端生成的更新时间。 */
  updatedAt: string;
  /** 更新后的实体版本号。 */
  version: number;
}

export interface DeletePeriodRecordData {
  /** 软删除时间。 */
  deletedAt: string;
  /** 更新时间，与软删除时间保持一致。 */
  updatedAt: string;
  /** 删除后的实体版本号。 */
  version: number;
}

/**
 * 周期模块仓储接口。
 *
 * service 层负责业务校验、幂等和同步日志编排；仓储层负责屏蔽内存存储与 PostgreSQL
 * 持久化之间的读写差异。
 */
export interface CycleRepository {
  /**
   * 获取指定用户的周期设置。
   *
   * @param userId 用户 ID。
   * @returns 周期设置；记录不存在时返回 `null`。
   */
  getSettings(userId: string): Promise<CycleSettingsRecord | null>;

  /**
   * 更新指定用户的周期设置。
   *
   * @param userId 用户 ID。
   * @param data 周期设置更新字段。
   * @returns 更新后的周期设置；记录不存在时返回 `null`。
   */
  updateSettings(userId: string, data: UpdateCycleSettingsData): Promise<CycleSettingsRecord | null>;

  /**
   * 分页列出指定用户的有效经期记录。
   *
   * @param userId 用户 ID。
   * @param options 分页参数。
   * @returns 当前页记录和下一页游标。
   */
  listPeriodRecords(userId: string, options: ListPeriodRecordsOptions): Promise<PeriodRecordsPage>;

  /**
   * 查找指定用户拥有的有效经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @returns 有效经期记录；记录不存在、已删除或不属于用户时返回 `null`。
   */
  findActivePeriodRecord(userId: string, recordId: string): Promise<PeriodRecord | null>;

  /**
   * 查找与候选日期区间重叠的经期记录。
   *
   * @param userId 用户 ID。
   * @param range 待写入或待更新的日期区间。
   * @returns 第一条冲突记录；没有冲突时返回 `null`。
   */
  findOverlappedPeriodRecord(userId: string, range: PeriodRecordDateRange): Promise<PeriodRecord | null>;

  /**
   * 创建经期记录。
   *
   * @param record service 层生成的完整经期记录。
   * @returns 已写入的经期记录。
   */
  createPeriodRecord(record: PeriodRecord): Promise<PeriodRecord>;

  /**
   * 更新经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 经期记录更新字段。
   * @returns 更新后的经期记录；记录不存在、已删除或不属于用户时返回 `null`。
   */
  updatePeriodRecord(userId: string, recordId: string, data: UpdatePeriodRecordData): Promise<PeriodRecord | null>;

  /**
   * 软删除经期记录。
   *
   * @param userId 用户 ID。
   * @param recordId 经期记录 ID。
   * @param data 软删除字段。
   * @returns 删除后的经期记录；记录不存在、已删除或不属于用户时返回 `null`。
   */
  softDeletePeriodRecord(userId: string, recordId: string, data: DeletePeriodRecordData): Promise<PeriodRecord | null>;
}

/**
 * 获取周期模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的周期仓储。
 */
export function getCycleRepository(): CycleRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresCycleRepository : memoryCycleRepository;
}
