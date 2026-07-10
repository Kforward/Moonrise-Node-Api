import {
  memoryStore,
  type AppReleaseEntryRecord,
  type AppReleaseRecord,
  type UserAppPreferencesRecord,
} from "../../infrastructure/database/memory-store";
import type {
  AppReleasesPage,
  AppReleaseWithEntries,
  AppRepository,
  ListAppReleasesOptions,
  UpdateAppPreferencesData,
} from "./app.repository";

/**
 * 内存版应用级仓储。
 *
 * 该实现服务本地联调和默认集成测试，行为与 PostgreSQL 仓储保持一致：偏好按用户唯一，
 * 更新日志只返回 `published=true` 的版本。
 */
export const memoryAppRepository: AppRepository = {
  /**
   * 获取或创建用户轻量偏好。
   *
   * @param userId 用户 ID。
   * @param timestamp 默认偏好创建时间。
   */
  async getOrCreatePreferences(userId: string, timestamp: string): Promise<UserAppPreferencesRecord> {
    const existingPreferences = memoryStore.userAppPreferences.get(userId);

    if (existingPreferences) {
      return existingPreferences;
    }

    const preferences: UserAppPreferencesRecord = {
      createdAt: timestamp,
      emptyGuideSkipped: false,
      historyEntryHintDismissed: false,
      updatedAt: timestamp,
      userId,
    };

    memoryStore.userAppPreferences.set(userId, preferences);

    return preferences;
  },

  /**
   * 更新内存中的用户轻量偏好。
   *
   * @param userId 用户 ID。
   * @param data 偏好更新字段。
   */
  async updatePreferences(userId: string, data: UpdateAppPreferencesData): Promise<UserAppPreferencesRecord | null> {
    const preferences = memoryStore.userAppPreferences.get(userId);

    if (!preferences) {
      return null;
    }

    if (data.emptyGuideSkipped !== undefined) {
      preferences.emptyGuideSkipped = data.emptyGuideSkipped;
    }
    if (data.historyEntryHintDismissed !== undefined) {
      preferences.historyEntryHintDismissed = data.historyEntryHintDismissed;
    }

    preferences.updatedAt = data.updatedAt;

    return preferences;
  },

  /**
   * 分页列出内存中的已发布更新日志。
   *
   * @param options 分页参数。
   */
  async listPublishedReleases(options: ListAppReleasesOptions): Promise<AppReleasesPage> {
    return sliceReleasePage(listPublishedReleases(), options);
  },

  /**
   * 按版本号查找内存中的已发布更新日志。
   *
   * @param version 应用版本号。
   */
  async findPublishedReleaseByVersion(version: string): Promise<AppReleaseWithEntries | null> {
    const release = [...memoryStore.appReleases.values()].find(item =>
      item.version === version && item.published
    );

    return release ? buildReleaseWithEntries(release) : null;
  },
};

/**
 * 列出已发布版本并按发布日期倒序排列。
 */
function listPublishedReleases(): AppReleaseWithEntries[] {
  return [...memoryStore.appReleases.values()]
    .filter(release => release.published)
    .sort(sortReleasesByReleasedAtDesc)
    .map(buildReleaseWithEntries);
}

/**
 * 为更新日志主记录附加条目。
 *
 * @param release 更新日志主记录。
 */
function buildReleaseWithEntries(release: AppReleaseRecord): AppReleaseWithEntries {
  return {
    entries: [...memoryStore.appReleaseEntries.values()]
      .filter(entry => entry.releaseId === release.id)
      .sort(sortEntriesByOrderAsc),
    release,
  };
}

/**
 * 按游标切分更新日志页。
 *
 * @param sortedReleases 已排序的更新日志。
 * @param options 分页参数。
 */
function sliceReleasePage(
  sortedReleases: AppReleaseWithEntries[],
  options: ListAppReleasesOptions,
): AppReleasesPage {
  const startIndex = options.cursor
    ? sortedReleases.findIndex(item => item.release.id === options.cursor) + 1
    : 0;
  const safeStartIndex = startIndex > 0 ? startIndex : 0;
  const items = sortedReleases.slice(safeStartIndex, safeStartIndex + options.limit);
  const nextRelease = sortedReleases[safeStartIndex + options.limit];

  return {
    items,
    nextCursor: nextRelease?.release.id ?? null,
  };
}

/**
 * 按发布日期倒序排列更新日志。
 */
function sortReleasesByReleasedAtDesc(left: AppReleaseRecord, right: AppReleaseRecord): number {
  const releasedAtComparison = right.releasedAt.localeCompare(left.releasedAt);

  return releasedAtComparison === 0 ? right.createdAt.localeCompare(left.createdAt) : releasedAtComparison;
}

/**
 * 按展示顺序排列更新日志条目。
 */
function sortEntriesByOrderAsc(left: AppReleaseEntryRecord, right: AppReleaseEntryRecord): number {
  const orderComparison = left.sortOrder - right.sortOrder;

  return orderComparison === 0 ? left.createdAt.localeCompare(right.createdAt) : orderComparison;
}
