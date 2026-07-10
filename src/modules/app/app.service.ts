import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import type {
  AppReleaseEntryRecord,
  AppReleaseRecord,
  UserAppPreferencesRecord,
} from "../../infrastructure/database/memory-store";
import { requireActiveSession } from "../auth/auth.service";
import { replayOrRunMutationAsync } from "../sync/idempotency.service";
import { appendSyncChangeAsync } from "../sync/sync-log.service";
import type {
  AppReleaseDetailQuery,
  ListAppReleasesQuery,
  UpdateAppPreferencesInput,
} from "./app.dto";
import { getAppRepository, type UpdateAppPreferencesData } from "./app.repository";

interface PublicAppPreferences {
  userId: string;
  historyEntryHintDismissed: boolean;
  emptyGuideSkipped: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PublicAppReleaseEntry {
  id: string;
  entryType: string;
  content: string;
  sortOrder: number;
}

interface PublicAppRelease {
  id: string;
  version: string;
  releasedAt: string;
  title: string;
  summary: string;
  entries: PublicAppReleaseEntry[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取当前用户轻量偏好。
 *
 * 轻量偏好承接首页提示和空状态引导等 UI 状态，不混入用户资料表；老用户缺少偏好行时
 * 会补一条默认记录，保证前端读取结果稳定。
 *
 * @param currentSession 当前用户与设备会话。
 */
export async function getCurrentAppPreferences(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const preferences = await getAppRepository().getOrCreatePreferences(session.user.id, nowIso());

  return {
    preferences: toPublicAppPreferences(preferences),
  };
}

/**
 * 更新当前用户轻量偏好。
 *
 * 偏好会参与跨设备同步，所以写入成功后追加 `user_app_preferences.update` 同步日志。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 更新偏好 DTO。
 */
export async function updateCurrentAppPreferences(
  currentSession: CurrentSession,
  input: UpdateAppPreferencesInput,
) {
  const session = await requireActiveSession(currentSession);
  const appRepository = getAppRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const timestamp = nowIso();

    await appRepository.getOrCreatePreferences(session.user.id, timestamp);

    const preferences = await appRepository.updatePreferences(
      session.user.id,
      buildPreferencesUpdateData(input, timestamp),
    );

    if (!preferences) {
      throw new AppError({
        code: ERROR_CODES.USER_NOT_FOUND,
        message: "用户偏好不存在或用户已停用",
        statusCode: 404,
      });
    }

    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: session.user.id,
      entityType: "user_app_preferences",
      operation: "update",
      userId: session.user.id,
    });

    return {
      preferences: toPublicAppPreferences(preferences),
    };
  });
}

/**
 * 分页列出已发布的应用更新日志。
 *
 * 更新日志是应用公开元数据，不包含用户隐私；只读接口只返回 `published=true` 的版本。
 *
 * @param query 分页查询参数。
 */
export async function listAppReleases(query: ListAppReleasesQuery) {
  const page = await getAppRepository().listPublishedReleases(query);

  return {
    items: page.items.map(item => toPublicAppRelease(item.release, item.entries)),
    nextCursor: page.nextCursor,
  };
}

/**
 * 获取指定版本的应用更新日志详情。
 *
 * @param query 版本查询参数。
 */
export async function getAppReleaseDetail(query: AppReleaseDetailQuery) {
  const release = await getAppRepository().findPublishedReleaseByVersion(query.version);

  if (!release) {
    throw new AppError({
      code: ERROR_CODES.APP_RELEASE_NOT_FOUND,
      message: "应用更新日志不存在或尚未发布",
      statusCode: 404,
    });
  }

  return {
    release: toPublicAppRelease(release.release, release.entries),
  };
}

/**
 * 构造偏好更新数据。
 *
 * @param input 偏好更新 DTO。
 * @param updatedAt 服务端生成的更新时间。
 */
function buildPreferencesUpdateData(
  input: UpdateAppPreferencesInput,
  updatedAt: string,
): UpdateAppPreferencesData {
  return {
    emptyGuideSkipped: input.payload.emptyGuideSkipped,
    historyEntryHintDismissed: input.payload.historyEntryHintDismissed,
    updatedAt,
  };
}

/**
 * 转换用户轻量偏好为公开响应。
 *
 * @param preferences 用户轻量偏好记录。
 */
function toPublicAppPreferences(preferences: UserAppPreferencesRecord): PublicAppPreferences {
  return {
    createdAt: preferences.createdAt,
    emptyGuideSkipped: preferences.emptyGuideSkipped,
    historyEntryHintDismissed: preferences.historyEntryHintDismissed,
    updatedAt: preferences.updatedAt,
    userId: preferences.userId,
  };
}

/**
 * 转换应用更新日志为公开响应。
 *
 * @param release 更新日志主记录。
 * @param entries 更新日志条目。
 */
function toPublicAppRelease(
  release: AppReleaseRecord,
  entries: AppReleaseEntryRecord[],
): PublicAppRelease {
  return {
    createdAt: release.createdAt,
    entries: entries.map(toPublicAppReleaseEntry),
    id: release.id,
    releasedAt: release.releasedAt,
    summary: release.summary,
    title: release.title,
    updatedAt: release.updatedAt,
    version: release.version,
  };
}

/**
 * 转换应用更新日志条目为公开响应。
 *
 * @param entry 更新日志条目记录。
 */
function toPublicAppReleaseEntry(entry: AppReleaseEntryRecord): PublicAppReleaseEntry {
  return {
    content: entry.content,
    entryType: entry.entryType,
    id: entry.id,
    sortOrder: entry.sortOrder,
  };
}
