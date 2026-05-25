import { randomUUID } from "node:crypto";
import { nowIso } from "../../common/utils/date-time";

export interface AppUserRecord {
  id: string;
  status: "active" | "disabled" | "deleted";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AuthIdentityRecord {
  id: string;
  userId: string;
  provider: "wechat_miniprogram" | "local_dev";
  providerSubject: string;
  unionSubject: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDeviceRecord {
  id: string;
  userId: string;
  deviceKeyHash: string;
  platform: string;
  deviceName: string | null;
  refreshTokenHash: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface UserProfileRecord {
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
  gender: number;
  phoneCiphertext: string | null;
  emailCiphertext: string | null;
  profileCiphertext: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CycleSettingsRecord {
  userId: string;
  avgCycleLength: number;
  avgPeriodLength: number;
  reminderEnabled: boolean;
  reminderDaysAhead: number;
  reminderTime: string;
  clientUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PeriodRecord {
  id: string;
  userId: string;
  clientRecordId: string;
  startDate: string;
  endDate: string | null;
  intensity: 1 | 2 | 3;
  painLevel: 0 | 1 | 2 | 3;
  moods: string[];
  notesCiphertext: string | null;
  version: number;
  clientUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MutationRecord {
  userId: string;
  clientMutationId: string;
  response: unknown;
  createdAt: string;
}

/**
 * 可参与前端增量同步的实体类型。
 *
 * 其中备份、隐私配置和保险箱实体当前还未开放接口，但保留枚举值便于后续模块接入
 * `sync_change_logs` 时保持统一协议。
 */
export type SyncEntityType = "user_profile" | "cycle_settings" | "period_record" | "backup_snapshot" | "privacy_config" | "vault_item";

/**
 * 同步变更操作类型。
 *
 * 前端离线合并时依赖该字段判断应创建、覆盖、软删除还是恢复本地实体。
 */
export type SyncOperation = "create" | "update" | "delete" | "restore";

/**
 * 开发期同步变更日志记录。
 *
 * 该结构对应后续 PostgreSQL 中的 `sync_change_logs` 表，用于让前端按递增 ID
 * 拉取当前用户的跨设备增量变更。
 */
export interface SyncChangeLogRecord {
  id: number;
  userId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  entityVersion: number | null;
  clientMutationId: string | null;
  checksum: string | null;
  createdAt: string;
}

/**
 * 开发期审计日志记录。
 *
 * 审计日志只保存动作、资源定位和非敏感元数据，避免把手机号、邮箱、经期备注或密文正文
 * 写入可检索日志。
 */
export interface AuditLogRecord {
  id: number;
  userId: string | null;
  deviceId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface MemoryStore {
  auditLogs: AuditLogRecord[];
  authIdentities: Map<string, AuthIdentityRecord>;
  cycleSettings: Map<string, CycleSettingsRecord>;
  devices: Map<string, UserDeviceRecord>;
  mutations: Map<string, MutationRecord>;
  nextAuditLogId: number;
  nextSyncChangeId: number;
  periodRecords: Map<string, PeriodRecord>;
  profiles: Map<string, UserProfileRecord>;
  syncChangeLogs: SyncChangeLogRecord[];
  users: Map<string, AppUserRecord>;
}

export const memoryStore: MemoryStore = {
  auditLogs: [],
  authIdentities: new Map(),
  cycleSettings: new Map(),
  devices: new Map(),
  mutations: new Map(),
  nextAuditLogId: 1,
  nextSyncChangeId: 1,
  periodRecords: new Map(),
  profiles: new Map(),
  syncChangeLogs: [],
  users: new Map(),
};

/**
 * 重置开发期内存仓储。
 *
 * 该函数主要服务集成测试，确保每个测试用例都从干净的数据状态启动，避免用户、设备、
 * 幂等快照和同步日志在用例之间相互污染。运行中的业务代码不应在请求处理中调用它。
 */
export function resetMemoryStore(): void {
  memoryStore.auditLogs.length = 0;
  memoryStore.authIdentities.clear();
  memoryStore.cycleSettings.clear();
  memoryStore.devices.clear();
  memoryStore.mutations.clear();
  memoryStore.nextAuditLogId = 1;
  memoryStore.nextSyncChangeId = 1;
  memoryStore.periodRecords.clear();
  memoryStore.profiles.clear();
  memoryStore.syncChangeLogs.length = 0;
  memoryStore.users.clear();
}

/**
 * 创建新用户以及默认资料和周期设置。
 *
 * 该函数是开发期内存仓储的聚合创建入口，后续替换 PostgreSQL 时应落到事务中。
 */
export function createDefaultUserBundle(): AppUserRecord {
  const timestamp = nowIso();
  const user: AppUserRecord = {
    createdAt: timestamp,
    deletedAt: null,
    id: randomUUID(),
    status: "active",
    updatedAt: timestamp,
  };

  memoryStore.users.set(user.id, user);
  memoryStore.profiles.set(user.id, {
    avatarUrl: null,
    createdAt: timestamp,
    emailCiphertext: null,
    gender: 0,
    nickname: null,
    phoneCiphertext: null,
    profileCiphertext: null,
    updatedAt: timestamp,
    userId: user.id,
  });
  memoryStore.cycleSettings.set(user.id, {
    avgCycleLength: 28,
    avgPeriodLength: 5,
    clientUpdatedAt: null,
    createdAt: timestamp,
    reminderDaysAhead: 3,
    reminderEnabled: false,
    reminderTime: "09:00",
    updatedAt: timestamp,
    userId: user.id,
  });

  return user;
}
