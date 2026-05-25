import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import type { CurrentSession } from "../../common/types/current-session";
import { appEnv } from "../config/env";

interface TokenPayload extends jwt.JwtPayload {
  deviceId: string;
  tokenType: "access" | "refresh";
  userId: string;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

const DEVELOPMENT_ACCESS_SECRET = "development-access-secret";
const DEVELOPMENT_REFRESH_SECRET = "development-refresh-secret";

/**
 * 获取 access token 签名密钥。
 *
 * 开发环境允许使用默认密钥，生产环境必须通过环境变量注入，避免误用弱密钥上线。
 */
function getAccessSecret(): string {
  if (appEnv.jwtAccessSecret) {
    return appEnv.jwtAccessSecret;
  }

  if (appEnv.nodeEnv === "production") {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "生产环境缺少 JWT_ACCESS_SECRET 配置",
      statusCode: 500,
    });
  }

  return DEVELOPMENT_ACCESS_SECRET;
}

/**
 * 获取 refresh token 签名密钥。
 *
 * refresh token 使用独立密钥，方便后续按安全策略单独轮换。
 */
function getRefreshSecret(): string {
  if (appEnv.jwtRefreshSecret) {
    return appEnv.jwtRefreshSecret;
  }

  if (appEnv.nodeEnv === "production") {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "生产环境缺少 JWT_REFRESH_SECRET 配置",
      statusCode: 500,
    });
  }

  return DEVELOPMENT_REFRESH_SECRET;
}

/**
 * 签发 access token 与 refresh token。
 *
 * @param session 当前用户与设备会话。
 */
export function issueTokenPair(session: CurrentSession): IssuedTokenPair {
  const refreshTokenId = randomUUID();
  const accessPayload: TokenPayload = {
    deviceId: session.deviceId,
    tokenType: "access",
    userId: session.userId,
  };
  const refreshPayload: TokenPayload = {
    deviceId: session.deviceId,
    jti: refreshTokenId,
    tokenType: "refresh",
    userId: session.userId,
  };

  return {
    accessToken: jwt.sign(accessPayload, getAccessSecret(), { expiresIn: "2h" }),
    refreshToken: jwt.sign(refreshPayload, getRefreshSecret(), { expiresIn: "30d" }),
    refreshTokenId,
  };
}

/**
 * 校验 access token 并返回当前会话。
 *
 * @param token 请求头中的 Bearer token。
 */
export function verifyAccessToken(token: string): CurrentSession {
  try {
    const payload = jwt.verify(token, getAccessSecret()) as TokenPayload;

    if (payload.tokenType !== "access") {
      throw new Error("invalid token type");
    }

    return {
      deviceId: payload.deviceId,
      userId: payload.userId,
    };
  } catch {
    throw new AppError({
      code: ERROR_CODES.INVALID_TOKEN,
      message: "登录状态无效，请重新登录",
      statusCode: 401,
    });
  }
}

/**
 * 校验 refresh token 并返回会话与 token ID。
 *
 * @param token 请求体中的 refresh token。
 */
export function verifyRefreshToken(token: string): CurrentSession & { refreshTokenId: string } {
  try {
    const payload = jwt.verify(token, getRefreshSecret()) as TokenPayload;

    if (payload.tokenType !== "refresh" || typeof payload.jti !== "string") {
      throw new Error("invalid token type");
    }

    return {
      deviceId: payload.deviceId,
      refreshTokenId: payload.jti,
      userId: payload.userId,
    };
  } catch {
    throw new AppError({
      code: ERROR_CODES.INVALID_TOKEN,
      message: "刷新凭证无效，请重新登录",
      statusCode: 401,
    });
  }
}
