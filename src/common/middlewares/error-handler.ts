import type { FastifyError, FastifyInstance } from "fastify";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";
import { buildErrorResponse } from "../responses/api-response";

/**
 * 注册统一错误处理器。
 *
 * 该处理器负责把业务异常和未知异常转换成统一 JSON 响应，避免各个业务模块重复写
 * try-catch 和响应包装逻辑。
 *
 * @param app Fastify 应用实例。
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send(buildErrorResponse(
        request.id,
        error.code,
        error.message,
        error.data,
      ));
      return;
    }

    request.log.error({ err: error }, "未处理的服务端异常");
    void reply.status(500).send(buildErrorResponse(
      request.id,
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      "服务暂时不可用，请稍后重试",
      null,
    ));
  });
}
