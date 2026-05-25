import { createHash } from "node:crypto";

/**
 * 计算稳定 SHA-256 哈希。
 *
 * 用于开发期保存设备键、refresh token 等不应明文持久化的值；生产环境可在仓储层
 * 替换为带盐或 KMS 参与的实现。
 *
 * @param value 待哈希的明文值。
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
