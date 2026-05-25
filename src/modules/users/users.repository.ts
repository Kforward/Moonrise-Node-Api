import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import type { AppUserRecord, UserDeviceRecord, UserProfileRecord } from "../../infrastructure/database/memory-store";
import { memoryUsersRepository } from "./users.memory-repository";
import { postgresUsersRepository } from "./users.postgres-repository";

export interface UpdateUserProfileData {
  /** 用户头像公开访问地址；传入 `undefined` 时表示不修改该字段。 */
  avatarUrl?: string | null;
  /** 邮箱密文；后端只保存密文，避免接触敏感明文。 */
  emailCiphertext?: string | null;
  /** 性别枚举值；传入 `undefined` 时表示不修改该字段。 */
  gender?: number;
  /** 用户昵称；允许写入 `null` 表示清空昵称。 */
  nickname?: string | null;
  /** 手机号密文；后端只保存密文，避免接触敏感明文。 */
  phoneCiphertext?: string | null;
  /** 扩展资料密文；用于保存前端加密后的个人资料扩展信息。 */
  profileCiphertext?: string | null;
  /** 服务端生成的资料更新时间。 */
  updatedAt: string;
}

/**
 * 用户资料更新后的聚合数据。
 *
 * service 层需要同时拿到用户主表和资料表，才能复用 auth 模块的公开资料转换函数。
 */
export interface UpdatedUserProfileBundle {
  /** 更新后的用户主表记录。 */
  user: AppUserRecord;
  /** 更新后的用户资料记录。 */
  profile: UserProfileRecord;
}

/**
 * 用户模块仓储接口。
 *
 * 该接口隔离内存仓储和 PostgreSQL 仓储差异，service 层只负责用户资料和设备管理
 * 的业务编排，不直接关心底层数据源。
 */
export interface UsersRepository {
  /**
   * 列出指定用户的设备。
   *
   * @param userId 用户 ID。
   * @returns 按创建时间倒序排列的设备记录。
   */
  listDevices(userId: string): Promise<UserDeviceRecord[]>;

  /**
   * 注销指定用户拥有的设备。
   *
   * @param userId 用户 ID。
   * @param deviceId 设备 ID。
   * @param revokedAt 注销时间。
   * @returns 更新后的设备记录；设备不存在或不属于用户时返回 `null`。
   */
  revokeDevice(userId: string, deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null>;

  /**
   * 更新用户资料。
   *
   * @param userId 用户 ID。
   * @param data 资料更新字段和更新时间。
   * @returns 更新后的用户与资料聚合；用户或资料不存在时返回 `null`。
   */
  updateProfile(userId: string, data: UpdateUserProfileData): Promise<UpdatedUserProfileBundle | null>;
}

/**
 * 获取用户模块仓储实现。
 *
 * @returns 当前数据库运行模式对应的用户仓储。
 */
export function getUsersRepository(): UsersRepository {
  return getDatabaseConfig().driver === "postgresql" ? postgresUsersRepository : memoryUsersRepository;
}
