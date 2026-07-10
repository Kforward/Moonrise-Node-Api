import { and, asc, desc, eq } from "drizzle-orm";
import type {
  AppReleaseEntryRecord,
  AppReleaseRecord,
  UserAppPreferencesRecord,
} from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import {
  appReleaseEntries,
  appReleases,
  userAppPreferences,
} from "../../infrastructure/database/schema";
import type {
  AppReleasesPage,
  AppReleaseWithEntries,
  AppRepository,
  ListAppReleasesOptions,
  UpdateAppPreferencesData,
} from "./app.repository";

type UserAppPreferencesRow = typeof userAppPreferences.$inferSelect;
type UserAppPreferencesInsert = typeof userAppPreferences.$inferInsert;
type AppReleaseRow = typeof appReleases.$inferSelect;
type AppReleaseEntryRow = typeof appReleaseEntries.$inferSelect;

/**
 * PostgreSQL 版应用级仓储。
 *
 * 用户偏好使用 `user_app_preferences` 一用户一行；更新日志读取 `published=true` 的版本
 * 和其条目，避免向前端暴露未发布内容。
 */
export const postgresAppRepository: AppRepository = {
  /**
   * 获取或创建 PostgreSQL 用户轻量偏好。
   *
   * @param userId 用户 ID。
   * @param timestamp 默认偏好创建时间。
   */
  async getOrCreatePreferences(userId: string, timestamp: string): Promise<UserAppPreferencesRecord> {
    const db = getDatabase();
    const [existingPreferences] = await db
      .select()
      .from(userAppPreferences)
      .where(eq(userAppPreferences.userId, userId))
      .limit(1);

    if (existingPreferences) {
      return toUserAppPreferencesRecord(existingPreferences);
    }

    const [createdPreferences] = await db
      .insert(userAppPreferences)
      .values({
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
      })
      .returning();

    return toUserAppPreferencesRecord(assertRow(createdPreferences, "创建用户轻量偏好失败"));
  },

  /**
   * 更新 PostgreSQL 用户轻量偏好。
   *
   * @param userId 用户 ID。
   * @param data 偏好更新字段。
   */
  async updatePreferences(userId: string, data: UpdateAppPreferencesData): Promise<UserAppPreferencesRecord | null> {
    const [preferences] = await getDatabase()
      .update(userAppPreferences)
      .set(buildPreferencesPatch(data))
      .where(eq(userAppPreferences.userId, userId))
      .returning();

    return preferences ? toUserAppPreferencesRecord(preferences) : null;
  },

  /**
   * 分页列出 PostgreSQL 中的已发布更新日志。
   *
   * @param options 分页参数。
   */
  async listPublishedReleases(options: ListAppReleasesOptions): Promise<AppReleasesPage> {
    const releases = await getDatabase()
      .select()
      .from(appReleases)
      .where(eq(appReleases.published, true))
      .orderBy(desc(appReleases.releasedAt), desc(appReleases.createdAt));

    return sliceReleasePage(await attachEntries(releases.map(toAppReleaseRecord)), options);
  },

  /**
   * 按版本号查找 PostgreSQL 中已发布更新日志。
   *
   * @param version 应用版本号。
   */
  async findPublishedReleaseByVersion(version: string): Promise<AppReleaseWithEntries | null> {
    const [release] = await getDatabase()
      .select()
      .from(appReleases)
      .where(and(
        eq(appReleases.version, version),
        eq(appReleases.published, true),
      ))
      .limit(1);

    if (!release) {
      return null;
    }

    const [releaseWithEntries] = await attachEntries([toAppReleaseRecord(release)]);

    return releaseWithEntries ?? null;
  },
};

/**
 * 构造用户偏好更新字段。
 *
 * @param data 偏好更新字段。
 */
function buildPreferencesPatch(data: UpdateAppPreferencesData): Partial<UserAppPreferencesInsert> {
  const patch: Partial<UserAppPreferencesInsert> = {
    updatedAt: data.updatedAt,
  };

  if (data.emptyGuideSkipped !== undefined) {
    patch.emptyGuideSkipped = data.emptyGuideSkipped;
  }
  if (data.historyEntryHintDismissed !== undefined) {
    patch.historyEntryHintDismissed = data.historyEntryHintDismissed;
  }

  return patch;
}

/**
 * 为更新日志主记录批量附加条目。
 *
 * @param releases 已排序的更新日志主记录。
 */
async function attachEntries(releases: AppReleaseRecord[]): Promise<AppReleaseWithEntries[]> {
  const entriesByReleaseId = new Map<string, AppReleaseEntryRecord[]>();

  for (const release of releases) {
    entriesByReleaseId.set(release.id, []);
  }

  if (releases.length === 0) {
    return [];
  }

  for (const release of releases) {
    const entries = await getDatabase()
      .select()
      .from(appReleaseEntries)
      .where(eq(appReleaseEntries.releaseId, release.id))
      .orderBy(asc(appReleaseEntries.sortOrder), asc(appReleaseEntries.createdAt));

    entriesByReleaseId.set(release.id, entries.map(toAppReleaseEntryRecord));
  }

  return releases.map(release => ({
    entries: entriesByReleaseId.get(release.id) ?? [],
    release,
  }));
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
 * 确认数据库写入返回了记录。
 *
 * @param row Drizzle returning 返回的首条记录。
 * @param message 写入失败时用于内部排查的错误消息。
 */
function assertRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) {
    throw new Error(message);
  }

  return row;
}

/**
 * 转换用户轻量偏好记录。
 */
function toUserAppPreferencesRecord(row: UserAppPreferencesRow): UserAppPreferencesRecord {
  return {
    createdAt: row.createdAt,
    emptyGuideSkipped: row.emptyGuideSkipped,
    historyEntryHintDismissed: row.historyEntryHintDismissed,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

/**
 * 转换应用更新日志主记录。
 */
function toAppReleaseRecord(row: AppReleaseRow): AppReleaseRecord {
  return {
    createdAt: row.createdAt,
    id: row.id,
    published: row.published,
    releasedAt: row.releasedAt,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updatedAt,
    version: row.version,
  };
}

/**
 * 转换应用更新日志条目记录。
 */
function toAppReleaseEntryRecord(row: AppReleaseEntryRow): AppReleaseEntryRecord {
  return {
    content: row.content,
    createdAt: row.createdAt,
    entryType: row.entryType,
    id: row.id,
    releaseId: row.releaseId,
    sortOrder: row.sortOrder,
  };
}
