import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { appendAuditLog } from "../audit/audit.service";
import { requireActiveSession, toPublicDevice, toPublicUserProfile } from "../auth/auth.service";
import { replayOrRunMutationAsync } from "../sync/idempotency.service";
import { appendSyncChangeAsync } from "../sync/sync-log.service";
import type { RevokeDeviceInput, UpdateUserProfileInput } from "./users.dto";
import { getUsersRepository, type UpdateUserProfileData } from "./users.repository";

/**
 * 获取当前用户资料。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户的公开资料响应。
 */
export async function getCurrentUserProfile(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);

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
 * @returns 更新后的公开用户资料响应。
 */
export async function updateCurrentUserProfile(currentSession: CurrentSession, input: UpdateUserProfileInput) {
  const session = await requireActiveSession(currentSession);
  const usersRepository = getUsersRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const timestamp = nowIso();
    const updateData = buildProfileUpdateData(input, timestamp);
    const updatedBundle = await usersRepository.updateProfile(session.user.id, updateData);

    if (!updatedBundle) {
      throw new AppError({
        code: ERROR_CODES.USER_NOT_FOUND,
        message: "用户资料不存在或已停用",
        statusCode: 404,
      });
    }
    await appendSyncChangeAsync({
      clientMutationId: input.clientMutationId,
      entityId: session.user.id,
      entityType: "user_profile",
      operation: "update",
      userId: session.user.id,
    });

    return {
      profile: toPublicUserProfile(updatedBundle.user, updatedBundle.profile),
    };
  });
}

/**
 * 列出当前用户绑定设备。
 *
 * @param currentSession 当前用户与设备会话。
 * @returns 当前用户绑定设备列表响应。
 */
export async function listCurrentUserDevices(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const devices = await getUsersRepository().listDevices(session.user.id);

  return {
    items: devices.map(toPublicDevice),
  };
}

/**
 * 注销当前用户名下指定设备。
 *
 * @param currentSession 当前用户与设备会话。
 * @param input 注销设备 DTO。
 * @returns 被注销设备的公开信息响应。
 */
export async function revokeUserDevice(currentSession: CurrentSession, input: RevokeDeviceInput) {
  const session = await requireActiveSession(currentSession);
  const usersRepository = getUsersRepository();

  return replayOrRunMutationAsync(session.user.id, input.clientMutationId, async () => {
    const device = await usersRepository.revokeDevice(session.user.id, input.payload.deviceId, nowIso());

    if (!device) {
      throw new AppError({
        code: ERROR_CODES.DEVICE_NOT_FOUND,
        message: "设备不存在或不属于当前用户",
        statusCode: 404,
      });
    }

    await appendAuditLog({
      action: "user_device.revoke",
      deviceId: session.device.id,
      resourceId: device.id,
      resourceType: "user_device",
      userId: session.user.id,
    });

    return {
      device: toPublicDevice(device),
    };
  });
}

/**
 * 构造用户资料更新数据。
 *
 * 该函数只接收 DTO 中允许更新的密文字段和公开展示字段，避免 service 层把额外
 * 请求字段透传到仓储。
 *
 * @param input 更新资料 DTO。
 * @param updatedAt 服务端更新时间。
 * @returns 仓储可写入的资料更新数据。
 */
function buildProfileUpdateData(input: UpdateUserProfileInput, updatedAt: string): UpdateUserProfileData {
  const updateData: UpdateUserProfileData = {
    updatedAt,
  };

  if (input.payload.avatarUrl !== undefined) {
    updateData.avatarUrl = input.payload.avatarUrl;
  }
  if (input.payload.emailCiphertext !== undefined) {
    updateData.emailCiphertext = input.payload.emailCiphertext;
  }
  if (input.payload.gender !== undefined) {
    updateData.gender = input.payload.gender;
  }
  if (input.payload.nickname !== undefined) {
    updateData.nickname = input.payload.nickname;
  }
  if (input.payload.phoneCiphertext !== undefined) {
    updateData.phoneCiphertext = input.payload.phoneCiphertext;
  }
  if (input.payload.profileCiphertext !== undefined) {
    updateData.profileCiphertext = input.payload.profileCiphertext;
  }

  return updateData;
}
