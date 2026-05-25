import type { ErrorCode } from "./error-codes";

export interface AppErrorOptions {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  data?: unknown;
}

/**
 * 业务异常基类。
 *
 * 业务模块通过抛出该异常表达可预期错误，由统一错误处理器映射为稳定的前端响应。
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly data: unknown;
  public readonly statusCode: number;

  /**
   * 创建一个可被统一错误处理器识别的业务异常。
   *
   * @param options 业务错误配置，包括错误码、用户可读消息、HTTP 状态码和额外上下文。
   */
  public constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.data = options.data ?? null;
    this.statusCode = options.statusCode ?? 400;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
