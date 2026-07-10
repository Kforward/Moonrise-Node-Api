import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type {
  AppReleaseEntryRecord,
  AppReleaseRecord,
  UserAppPreferencesRecord,
} from "../../infrastructure/database/memory-store";
import { memoryAppRepository } from "./app.memory-repository";
import { postgresAppRepository } from "./app.postgres-repository";

export interface UpdateAppPreferencesData {
  /** 是否跳过首页空状态引导；传入 `undefined` 表示不修改。 */
  emptyGuideSkipped?: boolean;
  /** 是否关闭历史补录提示；传入 `undefined` 表示不修改。 */
  historyEntryHintDismissed?: boolean;
  /** 服务端生成的更新时间。 */
  updatedAt: string;
}

export interface ListAppReleasesOptions {
  /** 当前页最后一条更新日志 ID；为空时从第一页开始。 */
  cursor?: string;
  /** 本次最多返回的版本数量。 */
  limit: number;
}

export interface AppReleaseWithEntries {
  /** 更新日志主记录。 */
  release: AppReleaseRecord;
  /** 当前版本的条目，按展示顺序排列。 */
  entries: AppReleaseEntryRecord[];
}

export interface AppReleasesPage {
  /** 当前页已发布更新日志。 */
  items: AppReleaseWithEntries[];
  /** 下一页游标；没有更多数据时返回 `null`。 */
  nextCursor: string | null;
}

/**
 * 应用级模块仓储接口。
 *
 * 该接口承接用户轻量偏好和应用更新日志，避免把这些应用级能力混入用户资料或周期模块。
 */
export interface AppRepository {
  /**
   * 获取用户偏好；若老用户缺少偏好行，则创建默认值。
   *
   * @param userId 用户 ID。
   * @param timestamp 创建默认偏好时使用的时间。
   */
  getOrCreatePreferences(userId: string, timestamp: string): Promise<UserAppPreferencesRecord>;

  /**
   * 更新用户轻量偏好。
   *
   * @param userId 用户 ID。
   * @param data 偏好更新字段。
   * @returns 更新后的偏好；用户或偏好不存在时返回 `null`。
   */
  updatePreferences(userId: string, data: UpdateAppPreferencesData): Promise<UserAppPreferencesRecord | null>;

  /**
   * 分页列出已发布的应用更新日志。
   *
   * @param options 分页参数。
   */
  listPublishedReleases(options: ListAppReleasesOptions): Promise<AppReleasesPage>;

  /**
   * 按版本号查找已发布更新日志。
   *
   * @param version 应用版本号。
   */
  findPublishedReleaseByVersion(version: string): Promise<AppReleaseWithEntries | null>;
}

/**
 * 获取应用级模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的应用级仓储。
 */
export function getAppRepository(): AppRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresAppRepository : memoryAppRepository;
}
