import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import { appEnv } from "../../infrastructure/config/env";
import {
  type AppUserRecord,
  type UserDeviceRecord,
  type UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import { issueTokenPair, verifyRefreshToken } from "../../infrastructure/tokens/token.service";
import { resolveWechatSessionIdentity } from "../../infrastructure/wechat/wechat-login.client";
import { appendAuditLog } from "../audit/audit.service";
import type { RefreshTokenInput, WechatLoginInput } from "./auth.dto";
import { getAuthRepository, type AuthSessionBundle } from "./auth.repository";

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

/**
 * 微信小程序登录。
 *
 * 生产环境通过微信 `jscode2session` 将前端一次性 code 换成 openid；开发环境在没有
 * 微信配置时仍可使用 mock 模式完成前端联调。微信 session key 不会落库，也不会返回给前端。
 *
 * @param input 微信登录请求 DTO。
 * @returns token、用户资料和设备信息。
 * @throws 微信登录凭证无效、微信服务不可用或会话写入失败时抛出业务错误。
 */
export async function loginWithWechat(input: WechatLoginInput) {
  const authRepository = getAuthRepository();
  const wechatIdentity = await resolveWechatSessionIdentity(input.code);
  const identity = await authRepository.findOrCreateWechatIdentity({
    providerSubject: wechatIdentity.openId,
    unionSubject: wechatIdentity.unionId,
  });
  const device = await authRepository.upsertDevice(identity.userId, input);
  const tokenPair = issueTokenPair({
    deviceId: device.id,
    userId: identity.userId,
  });

  await authRepository.updateDeviceSession(device.id, {
    lastSeenAt: nowIso(),
    refreshTokenHash: sha256(tokenPair.refreshToken),
  });

  const session = await requireActiveSession({
    deviceId: device.id,
    userId: identity.userId,
  });
  await appendAuditLog({
    action: "auth.login",
    deviceId: device.id,
    metadata: {
      loginMode: appEnv.wechatLoginMode,
      provider: identity.provider,
    },
    resourceId: device.id,
    resourceType: "user_device",
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
 * @returns 新签发的 access token 与 refresh token。
 * @throws refresh token 无效或设备会话失效时抛出业务错误。
 */
export async function refreshSession(input: RefreshTokenInput) {
  const refreshSessionPayload = verifyRefreshToken(input.refreshToken);
  const session = await requireActiveSession(refreshSessionPayload);
  const expectedHash = sha256(input.refreshToken);

  if (session.device.refreshTokenHash !== expectedHash) {
    throw new AppError({
      code: ERROR_CODES.INVALID_TOKEN,
      message: "刷新凭证已失效，请重新登录",
      statusCode: 401,
    });
  }

  const authRepository = getAuthRepository();
  const tokenPair = issueTokenPair({
    deviceId: session.device.id,
    userId: session.user.id,
  });

  await authRepository.updateDeviceSession(session.device.id, {
    lastSeenAt: nowIso(),
    refreshTokenHash: sha256(tokenPair.refreshToken),
  });
  await appendAuditLog({
    action: "auth.refresh",
    deviceId: session.device.id,
    resourceId: session.device.id,
    resourceType: "user_device",
    userId: session.user.id,
  });

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
 * @returns 已注销的设备 ID 和注销时间。
 * @throws 当前会话无效或设备已注销时抛出业务错误。
 */
export async function logoutSession(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);
  const revokedAt = nowIso();

  await getAuthRepository().revokeDevice(session.device.id, revokedAt);
  await appendAuditLog({
    action: "auth.logout",
    deviceId: session.device.id,
    resourceId: session.device.id,
    resourceType: "user_device",
    userId: session.user.id,
  });

  return {
    deviceId: session.device.id,
    revokedAt,
  };
}

/**
 * 获取当前会话详情。
 *
 * @param currentSession 当前 access token 解析出的用户与设备。
 * @returns 当前用户资料和设备信息。
 * @throws 当前会话无效或设备已注销时抛出业务错误。
 */
export async function getCurrentSession(currentSession: CurrentSession) {
  const session = await requireActiveSession(currentSession);

  return {
    device: toPublicDevice(session.device),
    user: toPublicUserProfile(session.user, session.profile),
  };
}

/**
 * 校验当前用户和设备仍处于可用状态。
 *
 * @param currentSession 当前 access token 解析出的用户与设备。
 * @returns 已校验的用户、资料和设备聚合。
 * @throws 用户不存在、设备不存在或设备已注销时抛出业务错误。
 */
export async function requireActiveSession(currentSession: CurrentSession): Promise<AuthSessionBundle> {
  const authRepository = getAuthRepository();
  const { device, profile, user } = await authRepository.findSession(currentSession);

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

  const touchedDevice = await authRepository.touchDeviceLastSeen(device.id, nowIso());

  return {
    device: touchedDevice ?? device,
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
