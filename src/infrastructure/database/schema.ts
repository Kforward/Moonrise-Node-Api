import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * 构造统一的带时区时间戳列。
 *
 * 数据库事件时间统一使用 `timestamptz`，TypeScript 侧以 ISO 字符串承接，避免在
 * service 层混用 Date 对象和字符串造成序列化差异。
 *
 * @param name 数据库列名。
 * @returns Drizzle timestamp 列构造器。
 */
function timestamptzColumn<TName extends string>(name: TName) {
  return timestamp(name, {
    mode: "string",
    withTimezone: true,
  });
}

/**
 * 用户生命周期状态枚举。
 */
export const userStatusEnum = pgEnum("user_status", ["active", "disabled", "deleted"]);

/**
 * 第三方认证来源枚举。
 */
export const authProviderEnum = pgEnum("auth_provider", ["wechat_miniprogram", "local_dev"]);

/**
 * 可同步实体类型枚举，必须和内存同步日志中的实体类型保持一致。
 */
export const syncEntityTypeEnum = pgEnum("sync_entity_type", [
  "user_profile",
  "cycle_settings",
  "period_record",
  "backup_snapshot",
  "privacy_config",
  "vault_item",
  "user_app_preferences",
]);

/**
 * 同步操作类型枚举。
 */
export const syncOperationEnum = pgEnum("sync_operation", ["create", "update", "delete", "restore"]);

/**
 * 云端隐私存储模式枚举。
 */
export const privacyStorageModeEnum = pgEnum("privacy_storage_mode", ["plain", "encrypted", "e2ee"]);

/**
 * 密文字段和快照使用的算法枚举。
 */
export const privacyCipherAlgorithmEnum = pgEnum("privacy_cipher_algorithm", [
  "none",
  "aes-256-gcm",
  "xchacha20-poly1305",
]);

/**
 * 用户主表，只保存账户生命周期状态，不直接保存资料和敏感字段。
 */
export const appUsers = pgTable("app_users", {
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deletedAt: timestamptzColumn("deleted_at"),
  id: uuid("id").primaryKey().defaultRandom(),
  status: userStatusEnum("status").notNull().default("active"),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
});

/**
 * 第三方身份绑定表。
 *
 * 微信 openid、unionid 等第三方主体信息独立建表，便于未来增加更多认证来源。
 */
export const authIdentities = pgTable("auth_identities", {
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  credentialHash: text("credential_hash"),
  id: uuid("id").primaryKey().defaultRandom(),
  provider: authProviderEnum("provider").notNull(),
  providerSubject: varchar("provider_subject", { length: 128 }).notNull(),
  unionSubject: varchar("union_subject", { length: 128 }),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("auth_identities_user_id_idx").on(table.userId),
  uniqueIndex("auth_identities_provider_subject_uidx").on(table.provider, table.providerSubject),
]);

/**
 * 用户设备表，用于刷新 token、设备注销和后续跨设备同步识别。
 */
export const userDevices = pgTable("user_devices", {
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deviceKeyHash: text("device_key_hash").notNull(),
  deviceName: varchar("device_name", { length: 120 }),
  id: uuid("id").primaryKey().defaultRandom(),
  lastSeenAt: timestamptzColumn("last_seen_at"),
  platform: varchar("platform", { length: 32 }).notNull(),
  publicKey: text("public_key"),
  refreshTokenHash: text("refresh_token_hash"),
  revokedAt: timestamptzColumn("revoked_at"),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("user_devices_user_id_idx").on(table.userId),
  uniqueIndex("user_devices_user_key_uidx").on(table.userId, table.deviceKeyHash),
]);

/**
 * 用户资料表。
 *
 * 手机号、邮箱和扩展资料只存密文或查询哈希，避免把隐私明文放入后端业务表。
 */
export const userProfiles = pgTable("user_profiles", {
  avatarUrl: text("avatar_url"),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  emailCiphertext: text("email_ciphertext"),
  emailHash: text("email_hash"),
  gender: smallint("gender").notNull().default(0),
  nickname: varchar("nickname", { length: 80 }),
  phoneCiphertext: text("phone_ciphertext"),
  phoneHash: text("phone_hash"),
  profileCiphertext: text("profile_ciphertext"),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").primaryKey().references(() => appUsers.id, { onDelete: "cascade" }),
});

/**
 * 周期设置表，对齐前端周期预测所需的基础配置。
 */
export const cycleSettings = pgTable("cycle_settings", {
  avgCycleLength: smallint("avg_cycle_length").notNull().default(28),
  avgPeriodLength: smallint("avg_period_length").notNull().default(5),
  clientUpdatedAt: timestamptzColumn("client_updated_at"),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  reminderDaysAhead: smallint("reminder_days_ahead").notNull().default(3),
  reminderEnabled: boolean("reminder_enabled").notNull().default(false),
  reminderTime: time("reminder_time").notNull().default(sql`'09:00'::time`),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").primaryKey().references(() => appUsers.id, { onDelete: "cascade" }),
});

/**
 * 结构化经期记录表。
 *
 * 备注字段只保存密文；删除采用软删除，便于同步删除事件和后续恢复审计。
 */
export const periodRecords = pgTable("period_records", {
  clientRecordId: varchar("client_record_id", { length: 80 }).notNull(),
  clientUpdatedAt: timestamptzColumn("client_updated_at"),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deletedAt: timestamptzColumn("deleted_at"),
  endDate: date("end_date", { mode: "string" }),
  id: uuid("id").primaryKey().defaultRandom(),
  intensity: smallint("intensity").notNull(),
  moods: jsonb("moods").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  notesCiphertext: text("notes_ciphertext"),
  painLevel: smallint("pain_level").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
  version: bigint("version", { mode: "number" }).notNull().default(1),
}, table => [
  index("period_records_user_start_idx").on(table.userId, table.startDate),
  uniqueIndex("period_records_user_client_uidx").on(table.userId, table.clientRecordId),
]);

/**
 * 用户轻量偏好表。
 *
 * 该表承接首页提示、空状态引导等 UI 偏好，不和用户资料或周期设置混表。
 */
export const userAppPreferences = pgTable("user_app_preferences", {
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  emptyGuideSkipped: boolean("empty_guide_skipped").notNull().default(false),
  historyEntryHintDismissed: boolean("history_entry_hint_dismissed").notNull().default(false),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").primaryKey().references(() => appUsers.id, { onDelete: "cascade" }),
});

/**
 * 用户隐私配置表。
 *
 * 服务端只保存模式、算法和密钥版本，不保存明文主密钥或端到端加密私钥。
 */
export const privacyConfigs = pgTable("privacy_configs", {
  cipherAlgorithm: privacyCipherAlgorithmEnum("cipher_algorithm").notNull().default("none"),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  e2eeEnabled: boolean("e2ee_enabled").notNull().default(false),
  keyVersion: integer("key_version").notNull().default(1),
  recoveryEnabled: boolean("recovery_enabled").notNull().default(false),
  storageMode: privacyStorageModeEnum("storage_mode").notNull().default("plain"),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").primaryKey().references(() => appUsers.id, { onDelete: "cascade" }),
});

/**
 * 端到端加密条目托管表。
 *
 * 服务端只理解实体类型、实体 ID 和密文元数据，不解析也不记录明文内容。
 */
export const encryptedVaultItems = pgTable("encrypted_vault_items", {
  aad: text("aad"),
  algorithm: privacyCipherAlgorithmEnum("algorithm").notNull(),
  ciphertext: text("ciphertext").notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deletedAt: timestamptzColumn("deleted_at"),
  entityId: varchar("entity_id", { length: 120 }).notNull(),
  entityType: syncEntityTypeEnum("entity_type").notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  keyVersion: integer("key_version").notNull(),
  nonce: text("nonce").notNull(),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("encrypted_vault_items_user_idx").on(table.userId),
  uniqueIndex("encrypted_vault_items_entity_uidx").on(table.userId, table.entityType, table.entityId),
]);

/**
 * 云端备份快照表。
 *
 * 快照保存完整密文，服务灾备恢复；它不替代结构化业务表和日常增量同步。
 */
export const backupSnapshots = pgTable("backup_snapshots", {
  algorithm: privacyCipherAlgorithmEnum("algorithm").notNull().default("none"),
  clientBackupId: varchar("client_backup_id", { length: 80 }).notNull(),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deletedAt: timestamptzColumn("deleted_at"),
  encrypted: boolean("encrypted").notNull().default(false),
  id: uuid("id").primaryKey().defaultRandom(),
  keyVersion: integer("key_version").notNull().default(1),
  sizeBytes: integer("size_bytes").notNull(),
  snapshotCiphertext: text("snapshot_ciphertext").notNull(),
  snapshotHash: text("snapshot_hash").notNull(),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("backup_snapshots_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("backup_snapshots_user_client_uidx").on(table.userId, table.clientBackupId),
]);

/**
 * 增量同步变更日志表。
 *
 * 所有影响前端跨设备同步的结构化实体写入，都应该在业务事务中追加一条记录。
 */
export const syncChangeLogs = pgTable("sync_change_logs", {
  checksum: text("checksum"),
  clientMutationId: varchar("client_mutation_id", { length: 120 }),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  entityId: varchar("entity_id", { length: 120 }).notNull(),
  entityType: syncEntityTypeEnum("entity_type").notNull(),
  entityVersion: bigint("entity_version", { mode: "number" }),
  id: bigserial("id", { mode: "number" }).primaryKey(),
  operation: syncOperationEnum("operation").notNull(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("sync_change_logs_user_id_idx").on(table.userId, table.id),
  uniqueIndex("sync_change_logs_user_mutation_uidx").on(table.userId, table.clientMutationId),
]);

/**
 * 幂等响应快照表。
 *
 * 写接口首次处理成功后会保存响应快照，后续相同用户、相同 `clientMutationId` 的重复提交
 * 直接返回首次响应，避免前端重试、网络抖动或小程序重复触发导致响应不一致。
 */
export const idempotencyRecords = pgTable("idempotency_records", {
  clientMutationId: varchar("client_mutation_id", { length: 120 }).notNull(),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  id: bigserial("id", { mode: "number" }).primaryKey(),
  response: jsonb("response").$type<unknown>().notNull(),
  userId: uuid("user_id").notNull().references(() => appUsers.id, { onDelete: "cascade" }),
}, table => [
  index("idempotency_records_user_created_idx").on(table.userId, table.createdAt),
  uniqueIndex("idempotency_records_user_mutation_uidx").on(table.userId, table.clientMutationId),
]);

/**
 * 安全审计日志表。
 *
 * 该表只记录动作、资源定位和非敏感元数据，敏感 payload 不能进入审计日志。
 */
export const auditLogs = pgTable("audit_logs", {
  action: varchar("action", { length: 80 }).notNull(),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  deviceId: uuid("device_id"),
  id: bigserial("id", { mode: "number" }).primaryKey(),
  ipHash: text("ip_hash"),
  metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>().notNull().default(sql`'{}'::jsonb`),
  resourceId: varchar("resource_id", { length: 120 }),
  resourceType: varchar("resource_type", { length: 80 }),
  success: boolean("success").notNull().default(true),
  userAgentHash: text("user_agent_hash"),
  userId: uuid("user_id").references(() => appUsers.id, { onDelete: "set null" }),
}, table => [
  index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
  index("audit_logs_user_created_idx").on(table.userId, table.createdAt),
]);

/**
 * 可选应用更新日志主表。
 */
export const appReleases = pgTable("app_releases", {
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  id: uuid("id").primaryKey().defaultRandom(),
  published: boolean("published").notNull().default(false),
  releasedAt: date("released_at", { mode: "string" }).notNull(),
  summary: text("summary").notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  updatedAt: timestamptzColumn("updated_at").notNull().defaultNow(),
  version: varchar("version", { length: 40 }).notNull(),
}, table => [
  uniqueIndex("app_releases_version_uidx").on(table.version),
]);

/**
 * 可选应用更新日志条目表。
 */
export const appReleaseEntries = pgTable("app_release_entries", {
  content: text("content").notNull(),
  createdAt: timestamptzColumn("created_at").notNull().defaultNow(),
  entryType: varchar("entry_type", { length: 40 }).notNull(),
  id: uuid("id").primaryKey().defaultRandom(),
  releaseId: uuid("release_id").notNull().references(() => appReleases.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
}, table => [
  index("app_release_entries_release_sort_idx").on(table.releaseId, table.sortOrder),
]);
