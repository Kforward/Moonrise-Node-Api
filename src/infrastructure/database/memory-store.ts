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

export interface MemoryStore {
  authIdentities: Map<string, AuthIdentityRecord>;
  cycleSettings: Map<string, CycleSettingsRecord>;
  devices: Map<string, UserDeviceRecord>;
  mutations: Map<string, MutationRecord>;
  periodRecords: Map<string, PeriodRecord>;
  profiles: Map<string, UserProfileRecord>;
  users: Map<string, AppUserRecord>;
}

export const memoryStore: MemoryStore = {
  authIdentities: new Map(),
  cycleSettings: new Map(),
  devices: new Map(),
  mutations: new Map(),
  periodRecords: new Map(),
  profiles: new Map(),
  users: new Map(),
};

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
