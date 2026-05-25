import { and, desc, eq } from "drizzle-orm";
import type {
  AppUserRecord,
  UserDeviceRecord,
  UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { appUsers, userDevices, userProfiles } from "../../infrastructure/database/schema";
import type { UpdatedUserProfileBundle, UpdateUserProfileData, UsersRepository } from "./users.repository";

type AppUserRow = typeof appUsers.$inferSelect;
type UserDeviceRow = typeof userDevices.$inferSelect;
type UserProfileRow = typeof userProfiles.$inferSelect;
type UserProfileInsert = typeof userProfiles.$inferInsert;

/**
 * PostgreSQL 版用户仓储。
 *
 * 该实现承接用户资料和设备管理的持久化读写，后续 cycle/sync 仓储会沿用同样的
 * service + repository 分层方式继续迁移。
 */
export const postgresUsersRepository: UsersRepository = {
  /**
   * 从 PostgreSQL 列出指定用户的设备记录。
   *
   * @param userId 用户 ID。
   * @returns 按创建时间倒序排列的设备记录。
   */
  async listDevices(userId: string): Promise<UserDeviceRecord[]> {
    const devices = await getDatabase()
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, userId))
      .orderBy(desc(userDevices.createdAt));

    return devices.map(toUserDeviceRecord);
  },

  /**
   * 在 PostgreSQL 中注销指定用户拥有的设备。
   *
   * @param userId 用户 ID。
   * @param deviceId 待注销的设备 ID。
   * @param revokedAt 服务端生成的注销时间。
   * @returns 更新后的设备记录；设备不存在或不属于用户时返回 `null`。
   */
  async revokeDevice(userId: string, deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null> {
    const [device] = await getDatabase()
      .update(userDevices)
      .set({
        refreshTokenHash: null,
        revokedAt,
      })
      .where(and(
        eq(userDevices.id, deviceId),
        eq(userDevices.userId, userId),
      ))
      .returning();

    return device ? toUserDeviceRecord(device) : null;
  },

  /**
   * 在 PostgreSQL 事务中更新用户资料和用户主表更新时间。
   *
   * @param userId 用户 ID。
   * @param data service 层整理后的资料更新字段。
   * @returns 更新后的用户与资料聚合；用户或资料不存在时返回 `null`。
   */
  async updateProfile(userId: string, data: UpdateUserProfileData): Promise<UpdatedUserProfileBundle | null> {
    return getDatabase().transaction(async tx => {
      const profilePatch = buildProfilePatch(data);
      const [profile] = await tx
        .update(userProfiles)
        .set(profilePatch)
        .where(eq(userProfiles.userId, userId))
        .returning();

      if (!profile) {
        return null;
      }

      const [user] = await tx
        .update(appUsers)
        .set({
          updatedAt: data.updatedAt,
        })
        .where(eq(appUsers.id, userId))
        .returning();

      if (!user) {
        return null;
      }

      return {
        profile: toUserProfileRecord(profile),
        user: toAppUserRecord(user),
      };
    });
  },
};

/**
 * 构造用户资料数据库更新字段。
 *
 * @param data service 层整理后的资料更新数据。
 * @returns 可传给 Drizzle update 的用户资料字段。
 */
function buildProfilePatch(data: UpdateUserProfileData): Partial<UserProfileInsert> {
  const profilePatch: Partial<UserProfileInsert> = {
    updatedAt: data.updatedAt,
  };

  if (data.avatarUrl !== undefined) {
    profilePatch.avatarUrl = data.avatarUrl;
  }
  if (data.emailCiphertext !== undefined) {
    profilePatch.emailCiphertext = data.emailCiphertext;
  }
  if (data.gender !== undefined) {
    profilePatch.gender = data.gender;
  }
  if (data.nickname !== undefined) {
    profilePatch.nickname = data.nickname;
  }
  if (data.phoneCiphertext !== undefined) {
    profilePatch.phoneCiphertext = data.phoneCiphertext;
  }
  if (data.profileCiphertext !== undefined) {
    profilePatch.profileCiphertext = data.profileCiphertext;
  }

  return profilePatch;
}

/**
 * 转换用户主表记录。
 *
 * @param row Drizzle 用户行。
 * @returns service 层使用的用户记录。
 */
function toAppUserRecord(row: AppUserRow): AppUserRecord {
  return {
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    id: row.id,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

/**
 * 转换用户设备记录。
 *
 * @param row Drizzle 设备行。
 * @returns service 层使用的设备记录。
 */
function toUserDeviceRecord(row: UserDeviceRow): UserDeviceRecord {
  return {
    createdAt: row.createdAt,
    deviceKeyHash: row.deviceKeyHash,
    deviceName: row.deviceName,
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    platform: row.platform,
    refreshTokenHash: row.refreshTokenHash,
    revokedAt: row.revokedAt,
    userId: row.userId,
  };
}

/**
 * 转换用户资料记录。
 *
 * @param row Drizzle 用户资料行。
 * @returns service 层使用的资料记录。
 */
function toUserProfileRecord(row: UserProfileRow): UserProfileRecord {
  return {
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    emailCiphertext: row.emailCiphertext,
    gender: row.gender,
    nickname: row.nickname,
    phoneCiphertext: row.phoneCiphertext,
    profileCiphertext: row.profileCiphertext,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}
