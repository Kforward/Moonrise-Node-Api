import { randomUUID } from "node:crypto";
import { nowIso } from "../../common/utils/date-time";
import { sha256 } from "../../common/utils/hash";
import {
  createDefaultUserBundle,
  memoryStore,
  type AuthIdentityRecord,
  type UserDeviceRecord,
} from "../../infrastructure/database/memory-store";
import type { WechatLoginInput } from "./auth.dto";
import type {
  AuthRepository,
  AuthSessionLookup,
  UpdateDeviceSessionInput,
  WechatIdentityBinding,
} from "./auth.repository";

/**
 * 内存版认证仓储。
 *
 * 该实现保留当前开发期行为，便于没有 PostgreSQL 的本地环境继续完成前端联调。
 */
export const memoryAuthRepository: AuthRepository = {
  /**
   * 查找或创建内存微信身份。
   *
   * @param identity 微信 openid 与可选 unionid。
   * @returns 已存在或新创建的微信身份记录。
   */
  async findOrCreateWechatIdentity(identity: WechatIdentityBinding): Promise<AuthIdentityRecord> {
    const identityKey = `wechat_miniprogram:${identity.providerSubject}`;
    const existingIdentity = memoryStore.authIdentities.get(identityKey);

    if (existingIdentity) {
      if (!existingIdentity.unionSubject && identity.unionSubject) {
        existingIdentity.unionSubject = identity.unionSubject;
        existingIdentity.updatedAt = nowIso();
      }

      return existingIdentity;
    }

    const user = createDefaultUserBundle();
    const timestamp = nowIso();
    const createdIdentity: AuthIdentityRecord = {
      createdAt: timestamp,
      id: randomUUID(),
      provider: "wechat_miniprogram",
      providerSubject: identity.providerSubject,
      unionSubject: identity.unionSubject,
      updatedAt: timestamp,
      userId: user.id,
    };

    memoryStore.authIdentities.set(identityKey, createdIdentity);

    return createdIdentity;
  },

  async findSession(currentSession): Promise<AuthSessionLookup> {
    return {
      device: memoryStore.devices.get(currentSession.deviceId) ?? null,
      profile: memoryStore.profiles.get(currentSession.userId) ?? null,
      user: memoryStore.users.get(currentSession.userId) ?? null,
    };
  },

  async revokeDevice(deviceId: string, revokedAt: string): Promise<UserDeviceRecord | null> {
    const device = memoryStore.devices.get(deviceId);

    if (!device) {
      return null;
    }

    device.revokedAt = revokedAt;
    device.refreshTokenHash = null;

    return device;
  },

  async touchDeviceLastSeen(deviceId: string, lastSeenAt: string): Promise<UserDeviceRecord | null> {
    const device = memoryStore.devices.get(deviceId);

    if (!device) {
      return null;
    }

    device.lastSeenAt = lastSeenAt;

    return device;
  },

  async updateDeviceSession(deviceId: string, input: UpdateDeviceSessionInput): Promise<UserDeviceRecord | null> {
    const device = memoryStore.devices.get(deviceId);

    if (!device) {
      return null;
    }

    if ("refreshTokenHash" in input) {
      device.refreshTokenHash = input.refreshTokenHash ?? null;
    }
    if ("lastSeenAt" in input) {
      device.lastSeenAt = input.lastSeenAt ?? null;
    }

    return device;
  },

  async upsertDevice(userId: string, input: WechatLoginInput): Promise<UserDeviceRecord> {
    const deviceKeyHash = sha256(input.deviceKey);
    const timestamp = nowIso();
    const existingDevice = [...memoryStore.devices.values()].find(device =>
      device.userId === userId && device.deviceKeyHash === deviceKeyHash
    );

    if (existingDevice) {
      existingDevice.deviceName = input.deviceName ?? existingDevice.deviceName;
      existingDevice.lastSeenAt = timestamp;
      existingDevice.platform = input.platform;
      existingDevice.revokedAt = null;
      return existingDevice;
    }

    const device: UserDeviceRecord = {
      createdAt: timestamp,
      deviceKeyHash,
      deviceName: input.deviceName ?? null,
      id: randomUUID(),
      lastSeenAt: timestamp,
      platform: input.platform,
      refreshTokenHash: null,
      revokedAt: null,
      userId,
    };

    memoryStore.devices.set(device.id, device);

    return device;
  },
};
