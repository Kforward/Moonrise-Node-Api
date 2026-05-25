/**
 * 后端统一错误码集合。
 *
 * 错误码需要稳定返回给前端，因此所有业务模块新增错误时都应先在这里登记。
 */
export const ERROR_CODES = {
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
