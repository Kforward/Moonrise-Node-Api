import { nowIso } from "../../common/utils/date-time";
import { getDatabaseConfig } from "../../infrastructure/config/database.config";
import { memoryStore, type AuditLogRecord } from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import { auditLogs } from "../../infrastructure/database/schema";

/**
 * 审计日志写入参数。
 *
 * 调用方只传入动作、资源定位和经过脱敏的上下文，避免审计模块接触业务密文或用户隐私明文。
 */
export interface AppendAuditLogInput {
  userId: string | null;
  deviceId: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  success?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * 写入审计日志。
 *
 * 审计日志只保存资源 ID、动作和非敏感元数据，不记录经期备注、手机号、邮箱或密文正文。
 *
 * @param input 审计日志输入。
 * @returns 已写入的审计日志记录。
 * @throws PostgreSQL 模式下写入失败时抛出内部错误。
 */
export async function appendAuditLog(input: AppendAuditLogInput): Promise<AuditLogRecord> {
  if (getDatabaseConfig().driver === "postgresql") {
    return appendPostgresAuditLog(input);
  }

  return appendMemoryAuditLog(input);
}

/**
 * 写入内存审计日志。
 *
 * @param input 审计日志输入。
 * @returns 内存审计日志记录。
 */
function appendMemoryAuditLog(input: AppendAuditLogInput): AuditLogRecord {
  const auditLog: AuditLogRecord = {
    action: input.action,
    createdAt: nowIso(),
    deviceId: input.deviceId,
    id: memoryStore.nextAuditLogId,
    metadata: input.metadata ?? {},
    resourceId: input.resourceId ?? null,
    resourceType: input.resourceType ?? null,
    success: input.success ?? true,
    userId: input.userId,
  };

  memoryStore.nextAuditLogId += 1;
  memoryStore.auditLogs.push(auditLog);

  return auditLog;
}

/**
 * 写入 PostgreSQL 审计日志。
 *
 * @param input 审计日志输入。
 * @returns 数据库审计日志记录。
 */
async function appendPostgresAuditLog(input: AppendAuditLogInput): Promise<AuditLogRecord> {
  const [auditLog] = await getDatabase().insert(auditLogs).values({
    action: input.action,
    deviceId: input.deviceId,
    metadata: input.metadata ?? {},
    resourceId: input.resourceId ?? null,
    resourceType: input.resourceType ?? null,
    success: input.success ?? true,
    userId: input.userId,
  }).returning();

  if (!auditLog) {
    throw new Error("写入审计日志失败");
  }

  return {
    action: auditLog.action,
    createdAt: auditLog.createdAt,
    deviceId: auditLog.deviceId,
    id: auditLog.id,
    metadata: auditLog.metadata,
    resourceId: auditLog.resourceId,
    resourceType: auditLog.resourceType,
    success: auditLog.success,
    userId: auditLog.userId,
  };
}
