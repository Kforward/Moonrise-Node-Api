import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import {
  createDefaultUserBundle,
  memoryStore,
  type AppUserRecord,
  type AuthIdentityRecord,
  type UserDeviceRecord,
  type UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import { appEnv } from "../../infrastructure/config/env";
import { issueTokenPair, verifyRefreshToken } from "../../infrastructure/tokens/token.service";
import type { RefreshTokenInput, WechatLoginInput } from "./auth.dto";

export interface PublicDevice {
  id: string;
  platform: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PublicUserProfile {
  userId: string;
  status: AppUserRecord["status"];
  nickname: string | null;
  avatarUrl: string | null;
  gender: number;
  phoneCiphertext: string | null;
  emailCiphertext: string | null;
  profileCiphertext: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionBundle {
  user: AppUserRecord;
  profile: UserProfileRecord;
  device: UserDeviceRecord;
}

/**
 * 开发期微信登录。
 *
 * 当前尚未接入微信服务端接口，先把 `code` 作为开发期 providerSubject 使用，保证
 * 前端可以先对接登录、设备会话和 token 刷新流程。
 *
 * @param input 微信登录请求 DTO。
 */
export function loginWithWechat(input: WechatLoginInput) {
  if (appEnv.nodeEnv === "production") {
    throw new AppError({
      code: ERROR_CODES.NOT_IMPLEMENTED,
      message: "生产环境需要先接入真实微信登录换取 openid",
      statusCode: 501,
    });
  }

  const identity = findOrCreateWechatIdentity(input.code);
  const device = upsertDevice(identity.userId, input);
  const tokenPair = issueTokenPair({
    deviceId: device.id,
    userId: identity.userId,
  });

  device.refreshTokenHash = sha256(tokenPair.refreshToken);
  device.lastSeenAt = nowIso();

  const session = requireActiveSession({
    deviceId: device.id,
    userId: identity.userId,
  });

  return {
    accessToken: tokenPair.accessToken,
    device: toPublicDevice(session.device),
    expiresIn: 7200,
    refreshToken: tokenPair.refreshToken,
    tokenType: "Bearer",
    user: toPublicUserProfile(session.user, session.profile),
  };
}

/**
 * 刷新当前设备的 token。
 *
 * @param input refresh token 请求 DTO。
 */
export function refreshSession(input: RefreshTokenInput) {
  const refreshSessionPayload = verifyRefreshToken(input.refreshToken);
  const session = requireActiveSession(refreshSessionPayload);
  const expectedHash = sha256(input.refreshToken);

  if (session.device.refreshTokenHash !== expectedHash) {
    throw new AppError({
      code: ERROR_CODES.INVALID_TOKEN,
      message: "刷新凭证已失效，请重新登录",
      statusCode: 401,
    });
  }

  const tokenPair = issueTokenPair({
    deviceId: session.device.id,
    userId: session.user.id,
  });

  session.device.refreshTokenHash = sha256(tokenPair.refreshToken);
  session.device.lastSeenAt = nowIso();

  return {
    accessToken: tokenPair.accessToken,
    expiresIn: 7200,
    refreshToken: tokenPair.refreshToken,
    tokenType: "Bearer",
  };
}

/**
 * 注销当前设备会话。
 *
 * @param currentSession 当前 access token 解析出的用户与设备。
 */
export function logoutSession(currentSession: CurrentSession) {
  const session = requireActiveSession(currentSession);

  session.device.revokedAt = nowIso();
  session.device.refreshTokenHash = null;

  return {
    deviceId: session.device.id,
    revokedAt: session.device.revokedAt,
  };
}

/**
 * 获取当前会话详情。
 *
 * @param currentSession 当前 access token 解析出的用户与设备。
 */
export function getCurrentSession(currentSession: CurrentSession) {
  const session = requireActiveSession(currentSession);

  return {
    device: toPublicDevice(session.device),
    user: toPublicUserProfile(session.user, session.profile),
  };
}

/**
 * 校验当前用户和设备仍处于可用状态。
 *
 * @param currentSession 当前 access token 解析出的用户与设备。
 */
export function requireActiveSession(currentSession: CurrentSession): AuthSessionBundle {
  const user = memoryStore.users.get(currentSession.userId);
  const profile = memoryStore.profiles.get(currentSession.userId);
  const device = memoryStore.devices.get(currentSession.deviceId);

  if (!user || !profile || user.status !== "active") {
    throw new AppError({
      code: ERROR_CODES.USER_NOT_FOUND,
      message: "用户不存在或已停用",
      statusCode: 401,
    });
  }

  if (!device || device.userId !== user.id) {
    throw new AppError({
      code: ERROR_CODES.DEVICE_NOT_FOUND,
      message: "设备会话不存在",
      statusCode: 401,
    });
  }

  if (device.revokedAt) {
    throw new AppError({
      code: ERROR_CODES.SESSION_REVOKED,
      message: "当前设备已退出登录",
      statusCode: 401,
    });
  }

  device.lastSeenAt = nowIso();

  return {
    device,
    profile,
    user,
  };
}

/**
 * 把用户资料转换为前端可见结构。
 *
 * @param user 用户主表记录。
 * @param profile 用户资料记录。
 */
export function toPublicUserProfile(user: AppUserRecord, profile: UserProfileRecord): PublicUserProfile {
  return {
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt,
    emailCiphertext: profile.emailCiphertext,
    gender: profile.gender,
    nickname: profile.nickname,
    phoneCiphertext: profile.phoneCiphertext,
    profileCiphertext: profile.profileCiphertext,
    status: user.status,
    updatedAt: profile.updatedAt,
    userId: user.id,
  };
}

/**
 * 把设备记录转换为前端可见结构。
 *
 * @param device 设备会话记录。
 */
export function toPublicDevice(device: UserDeviceRecord): PublicDevice {
  return {
    createdAt: device.createdAt,
    deviceName: device.deviceName,
    id: device.id,
    lastSeenAt: device.lastSeenAt,
    platform: device.platform,
    revokedAt: device.revokedAt,
  };
}

/**
 * 查找或创建开发期微信身份。
 *
 * @param code 微信登录 code，开发期作为 providerSubject 使用。
 */
function findOrCreateWechatIdentity(code: string): AuthIdentityRecord {
  const identityKey = `wechat_miniprogram:${code}`;
  const existingIdentity = memoryStore.authIdentities.get(identityKey);

  if (existingIdentity) {
    return existingIdentity;
  }

  const user = createDefaultUserBundle();
  const timestamp = nowIso();
  const identity: AuthIdentityRecord = {
    createdAt: timestamp,
    id: randomUUID(),
    provider: "wechat_miniprogram",
    providerSubject: code,
    unionSubject: null,
    updatedAt: timestamp,
    userId: user.id,
  };

  memoryStore.authIdentities.set(identityKey, identity);

  return identity;
}

/**
 * 创建或恢复同一用户下的设备会话。
 *
 * @param userId 用户 ID。
 * @param input 登录请求中的设备信息。
 */
function upsertDevice(userId: string, input: WechatLoginInput): UserDeviceRecord {
  const deviceKeyHash = sha256(input.deviceKey);
  const timestamp = nowIso();
  const existingDevice = [...memoryStore.devices.values()].find(device =>
    device.userId === userId && device.deviceKeyHash === deviceKeyHash
  );

  if (existingDevice) {
    existingDevice.deviceName = input.deviceName ?? existingDevice.deviceName;
    existingDevice.lastSeenAt = timestamp;
    existingDevice.platform = input.platform;
    existingDevice.revokedAt = null;
    return existingDevice;
  }

  const device: UserDeviceRecord = {
    createdAt: timestamp,
    deviceKeyHash,
    deviceName: input.deviceName ?? null,
    id: randomUUID(),
    lastSeenAt: timestamp,
    platform: input.platform,
    refreshTokenHash: null,
    revokedAt: null,
    userId,
  };

  memoryStore.devices.set(device.id, device);

  return device;
}
