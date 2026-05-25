import {
  memoryStore,
  type UserDeviceRecord,
  type UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import type { UpdatedUserProfileBundle, UpdateUserProfileData, UsersRepository } from "./users.repository";

/**
 * 内存版用户仓储。
 *
 * 该实现保留当前开发期数据行为，方便没有 PostgreSQL 的本地环境继续对接前端。
 */
export const memoryUsersRepository: UsersRepository = {
  /**
   * 列出指定用户的内存设备记录。
   *
   * @param userId 用户 ID。
   * @returns 按创建时间倒序排列的设备记录。
   */
  async listDevices(userId: string): Promise<UserDeviceRecord[]> {
    return [...memoryStore.devices.values()]
      .filter(device => device.userId === userId)
      .sort(sortDevicesByCreatedAtDesc);
  },

  /**
   * 注销指定用户拥有的内存设备。
   *
   * @param userId 用户 ID。
   * @param deviceId 待注销的设备 ID。
   * @param revokedAt 服务端生成的注销时间。
   * @returns 更新后的设备记录；设备不存在或不属于用户时返回 `null`。
   */
  async revokeDevice(userId: string, deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null> {
    const device = memoryStore.devices.get(deviceId);

    if (!device || device.userId !== userId) {
      return null;
    }

    device.revokedAt = revokedAt;
    device.refreshTokenHash = null;

    return device;
  },

  /**
   * 更新内存中的用户资料。
   *
   * @param userId 用户 ID。
   * @param data service 层整理后的资料更新字段。
   * @returns 更新后的用户与资料聚合；用户或资料不存在时返回 `null`。
   */
  async updateProfile(userId: string, data: UpdateUserProfileData): Promise<UpdatedUserProfileBundle | null> {
    const user = memoryStore.users.get(userId);
    const profile = memoryStore.profiles.get(userId);

    if (!user || !profile) {
      return null;
    }

    applyProfilePatch(profile, data);
    user.updatedAt = data.updatedAt;

    return {
      profile,
      user,
    };
  },
};

/**
 * 把资料更新字段应用到内存资料记录。
 *
 * @param profile 当前用户资料记录。
 * @param data 资料更新字段。
 */
function applyProfilePatch(profile: UserProfileRecord, data: UpdateUserProfileData): void {
  if (data.avatarUrl !== undefined) {
    profile.avatarUrl = data.avatarUrl;
  }
  if (data.emailCiphertext !== undefined) {
    profile.emailCiphertext = data.emailCiphertext;
  }
  if (data.gender !== undefined) {
    profile.gender = data.gender;
  }
  if (data.nickname !== undefined) {
    profile.nickname = data.nickname;
  }
  if (data.phoneCiphertext !== undefined) {
    profile.phoneCiphertext = data.phoneCiphertext;
  }
  if (data.profileCiphertext !== undefined) {
    profile.profileCiphertext = data.profileCiphertext;
  }

  profile.updatedAt = data.updatedAt;
}

/**
 * 按创建时间倒序排列设备。
 *
 * @param left 左侧设备记录。
 * @param right 右侧设备记录。
 */
function sortDevicesByCreatedAtDesc(left: UserDeviceRecord, right: UserDeviceRecord): number {
  return right.createdAt.localeCompare(left.createdAt);
}
