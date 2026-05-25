/**
 * 返回当前时间的 ISO 字符串。
 *
 * 统一封装时间生成点，后续写测试或替换为数据库时间时更容易集中处理。
 */
export function nowIso(): string {
  return new Date().toISOString();
}
