import type { CurrentSession } from "../../common/types/current-session";
import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type {
  AppUserRecord,
  AuthIdentityRecord,
  UserDeviceRecord,
  UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import type { WechatLoginInput } from "./auth.dto";
import { memoryAuthRepository } from "./auth.memory-repository";
import { postgresAuthRepository } from "./auth.postgres-repository";

export interface AuthSessionLookup {
  user: AppUserRecord | null;
  profile: UserProfileRecord | null;
  device: UserDeviceRecord | null;
}

/**
 * 已通过业务校验的认证会话聚合。
 *
 * service 层拿到该结构后，可以确信用户、资料和设备都存在且设备未被注销。
 */
export interface AuthSessionBundle {
  user: AppUserRecord;
  profile: UserProfileRecord;
  device: UserDeviceRecord;
}

/**
 * 设备会话可更新字段。
 *
 * refresh token 只保存哈希，最近活跃时间用于设备列表和会话风控。
 */
export interface UpdateDeviceSessionInput {
  refreshTokenHash?: string | null;
  lastSeenAt?: string | null;
}

/**
 * 认证模块仓储接口。
 *
 * 该接口隔离内存仓储和 PostgreSQL 仓储差异，service 层只关心认证业务流程，
 * 不直接依赖具体数据库实现。
 */
export interface AuthRepository {
  /**
   * 查找或创建微信小程序身份。
   *
   * @param providerSubject 微信 openid；开发期暂时使用登录 code 代替。
   * @returns 已存在或新创建的第三方身份记录。
   */
  findOrCreateWechatIdentity(providerSubject: string): Promise<AuthIdentityRecord>;

  /**
   * 按 token 中的用户和设备 ID 查找会话聚合。
   *
   * @param currentSession access/refresh token 解析出的会话定位信息。
   * @returns 可能缺失部分实体的会话查询结果，业务校验由 service 层完成。
   */
  findSession(currentSession: CurrentSession): Promise<AuthSessionLookup>;

  /**
   * 注销指定设备并清空 refresh token 哈希。
   *
   * @param deviceId 设备 ID。
   * @param revokedAt 注销时间。
   * @returns 更新后的设备记录；设备不存在时返回 `null`。
   */
  revokeDevice(deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null>;

  /**
   * 更新设备最近活跃时间。
   *
   * @param deviceId 设备 ID。
   * @param lastSeenAt 最近活跃时间。
   * @returns 更新后的设备记录；设备不存在时返回 `null`。
   */
  touchDeviceLastSeen(deviceId: string, lastSeenAt: string): Promise<UserDeviceRecord | null>;

  /**
   * 更新设备会话字段。
   *
   * @param deviceId 设备 ID。
   * @param input refresh token 哈希和最近活跃时间。
   * @returns 更新后的设备记录；设备不存在时返回 `null`。
   */
  updateDeviceSession(deviceId: string, input: UpdateDeviceSessionInput): Promise<UserDeviceRecord | null>;

  /**
   * 创建或恢复同一用户下的设备会话。
   *
   * @param userId 用户 ID。
   * @param input 登录请求中的设备信息。
   * @returns 已创建或已恢复的设备记录。
   */
  upsertDevice(userId: string, input: WechatLoginInput): Promise<UserDeviceRecord>;
}

/**
 * 获取认证仓储实现。
 *
 * 默认内存实现继续服务前端本地联调；当 `DATABASE_DRIVER=postgresql` 时，认证模块会
 * 切换到 Drizzle/PostgreSQL 仓储，为后续 users/cycle/sync 仓储迁移打基础。
 *
 * @returns 当前运行模式对应的认证仓储。
 */
export function getAuthRepository(): AuthRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresAuthRepository : memoryAuthRepository;
}
