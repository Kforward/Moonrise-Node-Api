export interface ApiResponse<TData> {
  success: boolean;
  code: string;
  message: string;
  data: TData;
  requestId: string;
}

/**
 * 构造成功响应。
 *
 * @param requestId 当前请求 ID，便于前端反馈问题时和后端日志对齐。
 * @param data 响应数据载荷。
 * @param message 前端可展示的成功消息。
 * @param code 稳定的成功码，默认使用 `OK`。
 */
export function buildSuccessResponse<TData>(
  requestId: string,
  data: TData,
  message = "success",
  code = "OK",
): ApiResponse<TData> {
  return {
    success: true,
    code,
    message,
    data,
    requestId,
  };
}

/**
 * 构造错误响应。
 *
 * @param requestId 当前请求 ID，便于排查错误来源。
 * @param code 稳定错误码。
 * @param message 前端可读错误消息。
 * @param data 非敏感错误上下文。
 */
export function buildErrorResponse<TData>(
  requestId: string,
  code: string,
  message: string,
  data: TData,
): ApiResponse<TData> {
  return {
    success: false,
    code,
    message,
    data,
    requestId,
  };
}
