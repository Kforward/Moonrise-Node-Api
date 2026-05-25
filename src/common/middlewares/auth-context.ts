import type { FastifyRequest } from "fastify";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";
import type { CurrentSession } from "../types/current-session";
import { verifyAccessToken } from "../../infrastructure/tokens/token.service";

/**
 * 从请求头中解析当前用户会话。
 *
 * 该函数只负责 HTTP 认证解析，不做业务权限判断；资源归属校验应放在各模块 service 中。
 *
 * @param request Fastify 请求对象。
 */
export function requireCurrentSession(request: FastifyRequest): CurrentSession {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError({
      code: ERROR_CODES.UNAUTHORIZED,
      message: "请先登录后再访问",
      statusCode: 401,
    });
  }

  return verifyAccessToken(authorization.slice("Bearer ".length));
}
