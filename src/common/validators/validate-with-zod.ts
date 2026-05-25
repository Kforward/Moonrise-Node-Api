import { ZodError } from "zod";
import type { z } from "zod";
import { AppError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";

/**
 * 使用 Zod 校验外部输入。
 *
 * 该函数把 Zod 的字段级错误转换为统一业务异常，保证所有 DTO 校验失败时都返回
 * 前端可识别的 `VALIDATION_FAILED` 响应。
 *
 * @param schema Zod 校验规则。
 * @param value 待校验的外部输入。
 */
export function validateWithZod<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError({
        code: ERROR_CODES.VALIDATION_FAILED,
        data: {
          issues: error.issues.map(issue => ({
            message: issue.message,
            path: issue.path.join("."),
          })),
        },
        message: "请求参数不符合要求",
        statusCode: 400,
      });
    }

    throw error;
  }
}
