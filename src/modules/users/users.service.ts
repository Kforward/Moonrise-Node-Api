import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { memoryStore, type UserDeviceRecord } from "../../infrastructure/database/memory-store";
import { requireActiveSession, toPublicDevice, toPublicUserProfile } from "../auth/auth.service";
import type { RevokeDeviceInput, UpdateUserProfileInput } from "./users.dto";

/**
 * 获取当前用户资料。
 *
 * @param currentSession 当前用户与设备会话。
 */
export function getCurrentUserProfile(currentSession: CurrentSession) {
  const session = requireActiveSession(currentSession);

  return {
    profile: toPublicUserProfile(session.user, session.profile),
  };
}

/**
 * 更新当前用户资料。
 *
 * 手机号、邮箱和扩展资料字段只接收密文字段，避免后端接口鼓励前端上传敏感明文。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 更新资料 DTO。
 */
export function updateCurrentUserProfile(currentSession: CurrentSession, input: UpdateUserProfileInput) {
  const session = requireActiveSession(currentSession);
  const profile = session.profile;
  const timestamp = nowIso();

  if (input.payload.avatarUrl !== undefined) {
    profile.avatarUrl = input.payload.avatarUrl;
  }
  if (input.payload.emailCiphertext !== undefined) {
    profile.emailCiphertext = input.payload.emailCiphertext;
  }
  if (input.payload.gender !== undefined) {
    profile.gender = input.payload.gender;
  }
  if (input.payload.nickname !== undefined) {
    profile.nickname = input.payload.nickname;
  }
  if (input.payload.phoneCiphertext !== undefined) {
    profile.phoneCiphertext = input.payload.phoneCiphertext;
  }
  if (input.payload.profileCiphertext !== undefined) {
    profile.profileCiphertext = input.payload.profileCiphertext;
  }

  profile.updatedAt = timestamp;
  session.user.updatedAt = timestamp;

  return {
    profile: toPublicUserProfile(session.user, profile),
  };
}

/**
 * 列出当前用户绑定设备。
 *
 * @param currentSession 当前用户与设备会话。
 */
export function listCurrentUserDevices(currentSession: CurrentSession) {
  const session = requireActiveSession(currentSession);
  const devices = [...memoryStore.devices.values()]
    .filter(device => device.userId === session.user.id)
    .sort(sortDevicesByCreatedAtDesc)
    .map(toPublicDevice);

  return {
    items: devices,
  };
}

/**
 * 注销当前用户名下指定设备。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 注销设备 DTO。
 */
export function revokeUserDevice(currentSession: CurrentSession, input: RevokeDeviceInput) {
  const session = requireActiveSession(currentSession);
  const device = memoryStore.devices.get(input.payload.deviceId);

  if (!device || device.userId !== session.user.id) {
    throw new AppError({
      code: ERROR_CODES.DEVICE_NOT_FOUND,
      message: "设备不存在或不属于当前用户",
      statusCode: 404,
    });
  }

  device.revokedAt = nowIso();
  device.refreshTokenHash = null;

  return {
    device: toPublicDevice(device),
  };
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
