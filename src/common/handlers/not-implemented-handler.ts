import type { RouteHandlerMethod } from "fastify";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";

/**
 * 创建模块占位处理器。
 *
 * 第一轮骨架重构先暴露稳定路由形状，但业务实现会在后续阶段逐步补齐。
 * 该处理器用 501 明确告诉前端和开发者：路径已保留，逻辑尚未完成。
 *
 * @param moduleName 模块名称，例如 auth、cycle。
 * @param nextStep 后续实现该接口时优先完成的动作说明。
 */
export function createNotImplementedHandler(moduleName: string, nextStep: string): RouteHandlerMethod {
  return async () => {
    throw new AppError({
      code: ERROR_CODES.NOT_IMPLEMENTED,
      data: {
        moduleName,
        nextStep,
      },
      message: `${moduleName} 模块骨架已就绪，业务实现待补齐`,
      statusCode: 501,
    });
  };
}
