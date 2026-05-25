import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import type {
  AppUserRecord,
  AuthIdentityRecord,
  UserDeviceRecord,
  UserProfileRecord,
} from "../../infrastructure/database/memory-store";
import { getDatabase } from "../../infrastructure/database/postgres-client";
import {
  appUsers,
  authIdentities,
  cycleSettings,
  privacyConfigs,
  userAppPreferences,
  userDevices,
  userProfiles,
} from "../../infrastructure/database/schema";
import type { WechatLoginInput } from "./auth.dto";
import type { AuthRepository, AuthSessionLookup, UpdateDeviceSessionInput } from "./auth.repository";

type AppUserRow = typeof appUsers.$inferSelect;
type AuthIdentityRow = typeof authIdentities.$inferSelect;
type UserDeviceRow = typeof userDevices.$inferSelect;
type UserProfileRow = typeof userProfiles.$inferSelect;
type UserDeviceInsert = typeof userDevices.$inferInsert;

/**
 * PostgreSQL 版认证仓储。
 *
 * 当前先覆盖登录、设备会话、token 刷新和会话校验所需的数据访问；users/cycle
 * 业务仓储会在后续步骤继续迁移到 PostgreSQL。
 */
export const postgresAuthRepository: AuthRepository = {
  async findOrCreateWechatIdentity(providerSubject: string): Promise<AuthIdentityRecord> {
    const db = getDatabase();
    const [existingIdentity] = await db
      .select()
      .from(authIdentities)
      .where(and(
        eq(authIdentities.provider, "wechat_miniprogram"),
        eq(authIdentities.providerSubject, providerSubject),
      ))
      .limit(1);

    if (existingIdentity) {
      return toAuthIdentityRecord(existingIdentity);
    }

    return db.transaction(async tx => {
      const timestamp = nowIso();
      const userId = randomUUID();
      const identityId = randomUUID();

      await tx.insert(appUsers).values({
        createdAt: timestamp,
        id: userId,
        updatedAt: timestamp,
      });
      await tx.insert(userProfiles).values({
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
      });
      await tx.insert(cycleSettings).values({
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
      });
      await tx.insert(userAppPreferences).values({
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
      });
      await tx.insert(privacyConfigs).values({
        createdAt: timestamp,
        updatedAt: timestamp,
        userId,
      });

      const [createdIdentity] = await tx.insert(authIdentities).values({
        createdAt: timestamp,
        id: identityId,
        provider: "wechat_miniprogram",
        providerSubject,
        updatedAt: timestamp,
        userId,
      }).returning();

      return toAuthIdentityRecord(assertRow(createdIdentity, "创建微信身份失败"));
    });
  },

  async findSession(currentSession): Promise<AuthSessionLookup> {
    const db = getDatabase();
    const [user] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, currentSession.userId))
      .limit(1);
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, currentSession.userId))
      .limit(1);
    const [device] = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.id, currentSession.deviceId))
      .limit(1);

    return {
      device: device ? toUserDeviceRecord(device) : null,
      profile: profile ? toUserProfileRecord(profile) : null,
      user: user ? toAppUserRecord(user) : null,
    };
  },

  async revokeDevice(deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null> {
    const [device] = await getDatabase()
      .update(userDevices)
      .set({
        refreshTokenHash: null,
        revokedAt,
      })
      .where(eq(userDevices.id, deviceId))
      .returning();

    return device ? toUserDeviceRecord(device) : null;
  },

  async touchDeviceLastSeen(deviceId: string, lastSeenAt: string): Promise<UserDeviceRecord | null> {
    return this.updateDeviceSession(deviceId, {
      lastSeenAt,
    });
  },

  async updateDeviceSession(deviceId: string, input: UpdateDeviceSessionInput): Promise<UserDeviceRecord | null> {
    const updateData: Partial<UserDeviceInsert> = {};

    if ("refreshTokenHash" in input) {
      updateData.refreshTokenHash = input.refreshTokenHash ?? null;
    }
    if ("lastSeenAt" in input) {
      updateData.lastSeenAt = input.lastSeenAt ?? null;
    }

    const [device] = await getDatabase()
      .update(userDevices)
      .set(updateData)
      .where(eq(userDevices.id, deviceId))
      .returning();

    return device ? toUserDeviceRecord(device) : null;
  },

  async upsertDevice(userId: string, input: WechatLoginInput): Promise<UserDeviceRecord> {
    const db = getDatabase();
    const deviceKeyHash = sha256(input.deviceKey);
    const timestamp = nowIso();
    const [existingDevice] = await db
      .select()
      .from(userDevices)
      .where(and(
        eq(userDevices.userId, userId),
        eq(userDevices.deviceKeyHash, deviceKeyHash),
      ))
      .limit(1);

    if (existingDevice) {
      const [updatedDevice] = await db
        .update(userDevices)
        .set({
          deviceName: input.deviceName ?? existingDevice.deviceName,
          lastSeenAt: timestamp,
          platform: input.platform,
          revokedAt: null,
        })
        .where(eq(userDevices.id, existingDevice.id))
        .returning();

      return toUserDeviceRecord(assertRow(updatedDevice, "更新设备会话失败"));
    }

    const [createdDevice] = await db.insert(userDevices).values({
      createdAt: timestamp,
      deviceKeyHash,
      deviceName: input.deviceName ?? null,
      id: randomUUID(),
      lastSeenAt: timestamp,
      platform: input.platform,
      userId,
    }).returning();

    return toUserDeviceRecord(assertRow(createdDevice, "创建设备会话失败"));
  },
};

/**
 * 确认数据库写入返回了记录。
 *
 * @param row Drizzle returning 返回的首条记录。
 * @param message 写入失败时用于内部排查的错误消息。
 * @returns 非空数据库记录。
 */
function assertRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) {
    throw new Error(message);
  }

  return row;
}

/**
 * 转换用户主表记录。
 *
 * @param row Drizzle 用户行。
 * @returns service 层使用的用户记录。
 */
function toAppUserRecord(row: AppUserRow): AppUserRecord {
  return {
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    id: row.id,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

/**
 * 转换认证身份记录。
 *
 * @param row Drizzle 第三方身份行。
 * @returns service 层使用的身份记录。
 */
function toAuthIdentityRecord(row: AuthIdentityRow): AuthIdentityRecord {
  return {
    createdAt: row.createdAt,
    id: row.id,
    provider: row.provider,
    providerSubject: row.providerSubject,
    unionSubject: row.unionSubject,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}

/**
 * 转换用户设备记录。
 *
 * @param row Drizzle 设备行。
 * @returns service 层使用的设备记录。
 */
function toUserDeviceRecord(row: UserDeviceRow): UserDeviceRecord {
  return {
    createdAt: row.createdAt,
    deviceKeyHash: row.deviceKeyHash,
    deviceName: row.deviceName,
    id: row.id,
    lastSeenAt: row.lastSeenAt,
    platform: row.platform,
    refreshTokenHash: row.refreshTokenHash,
    revokedAt: row.revokedAt,
    userId: row.userId,
  };
}

/**
 * 转换用户资料记录。
 *
 * @param row Drizzle 用户资料行。
 * @returns service 层使用的资料记录。
 */
function toUserProfileRecord(row: UserProfileRow): UserProfileRecord {
  return {
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt,
    emailCiphertext: row.emailCiphertext,
    gender: row.gender,
    nickname: row.nickname,
    phoneCiphertext: row.phoneCiphertext,
    profileCiphertext: row.profileCiphertext,
    updatedAt: row.updatedAt,
    userId: row.userId,
  };
}
