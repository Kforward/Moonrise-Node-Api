import { nowIso } from "../../common/utils/date-time";
import { memoryStore, type AuditLogRecord } from "../../infrastructure/database/memory-store";

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
 */
export function appendAuditLog(input: AppendAuditLogInput): AuditLogRecord {
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
