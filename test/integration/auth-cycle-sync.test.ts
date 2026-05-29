import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { FastifyInstance } from "fastify";

process.env.NODE_ENV = "test";
process.env.DATABASE_DRIVER = "memory";
process.env.LOG_LEVEL = "silent";
process.env.WECHAT_LOGIN_MODE = "mock";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

interface ApiResponse<TData> {
  success: boolean;
  code: string;
  message: string;
  data: TData;
  requestId: string;
}

interface LoginData {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  user: {
    userId: string;
    nickname: string | null;
  };
  device: {
    id: string;
  };
}

interface RefreshData {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
}

interface ProfileData {
  profile: {
    userId: string;
    nickname: string | null;
  };
}

interface PeriodRecordData {
  record: {
    id: string;
    clientRecordId: string;
    startDate: string;
    endDate: string | null;
  };
}

interface SyncChangesData {
  items: Array<{
    id: number;
    entityType: string;
    entityId: string;
    operation: string;
    clientMutationId: string | null;
  }>;
  nextVersion: number;
}

interface SyncStateData {
  latestVersion: number;
}

interface BackupSnapshotSummary {
  id: string;
  clientBackupId: string;
  encrypted: boolean;
  algorithm: string;
  keyVersion: number;
  sizeBytes: number;
  snapshotHash: string;
  createdAt: string;
  updatedAt: string;
}

interface BackupSnapshotDetail extends BackupSnapshotSummary {
  snapshotCiphertext: string;
}

interface BackupSnapshotData {
  snapshot: BackupSnapshotSummary;
}

interface BackupSnapshotDetailData {
  snapshot: BackupSnapshotDetail;
}

interface BackupSnapshotsPageData {
  items: BackupSnapshotSummary[];
  nextCursor: string | null;
}

interface BackupRestoreData {
  restoredAt: string;
  snapshot: BackupSnapshotSummary;
}

interface BackupDeleteData {
  deletedAt: string;
  snapshotId: string;
}

interface PrivacyConfigData {
  config: {
    userId: string;
    storageMode: string;
    cipherAlgorithm: string;
    keyVersion: number;
    e2eeEnabled: boolean;
    recoveryEnabled: boolean;
  };
}

interface VaultItemSummary {
  id: string;
  entityType: string;
  entityId: string;
  algorithm: string;
  keyVersion: number;
  nonce: string;
  aad: string | null;
  ciphertext: string;
  contentHash: string;
}

interface VaultItemData {
  item: VaultItemSummary;
  operation: string;
}

interface VaultItemsPageData {
  items: VaultItemSummary[];
  nextCursor: string | null;
}

interface SyncPushResultItem {
  clientMutationId: string;
  entityType: string;
  operation: string;
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    data: unknown;
  };
}

interface SyncPushData {
  failedCount: number;
  latestVersion: number;
  results: SyncPushResultItem[];
  successCount: number;
}

interface RateLimitedData {
  retryAfterSeconds: number;
}

/**
 * 创建内存模式测试应用。
 *
 * 每个用例都会先清空内存仓储，再构建独立 Fastify 实例，避免身份、设备、幂等快照和
 * 同步日志跨用例泄漏。
 *
 * @param context Node test 当前用例上下文。
 * @returns 可通过 `inject` 发起请求的 Fastify 应用实例。
 */
async function createMemoryTestApp(context: TestContext): Promise<FastifyInstance> {
  const [{ buildApp }, { resetMemoryStore }] = await Promise.all([
    import("../../src/app"),
    import("../../src/infrastructure/database/memory-store"),
  ]);

  resetMemoryStore();
  const app = await buildApp();

  context.after(async () => {
    await app.close();
  });

  return app;
}

/**
 * 解析统一 API 响应。
 *
 * @param response Fastify inject 响应。
 * @returns 已按统一响应结构转换后的 JSON。
 */
function parseApiResponse<TData>(response: { body: string }): ApiResponse<TData> {
  return JSON.parse(response.body) as ApiResponse<TData>;
}

/**
 * 构造 JSON 请求参数。
 *
 * @param payload 请求体对象。
 * @returns Fastify inject 可直接使用的请求头和序列化请求体。
 */
function jsonRequest(payload: unknown): { headers: Record<string, string>; payload: string } {
  return {
    headers: {
      "content-type": "application/json",
    },
    payload: JSON.stringify(payload),
  };
}

/**
 * 构造登录态请求头。
 *
 * @param accessToken 后端签发的 access token。
 * @returns 带 Bearer token 的请求头。
 */
function authHeaders(accessToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

/**
 * 构造登录态 JSON 请求参数。
 *
 * @param accessToken 后端签发的 access token。
 * @param payload 请求体对象。
 * @returns 带认证头、JSON 头和序列化请求体的请求参数。
 */
function authJsonRequest(accessToken: string, payload: unknown): { headers: Record<string, string>; payload: string } {
  const request = jsonRequest(payload);

  return {
    headers: {
      ...request.headers,
      ...authHeaders(accessToken),
    },
    payload: request.payload,
  };
}

/**
 * 使用开发期 mock 微信 code 登录。
 *
 * @param app Fastify 测试应用。
 * @param code 当前测试用例使用的 mock code。
 * @returns 登录成功后的 token、用户和设备信息。
 */
async function loginWithMockWechat(app: FastifyInstance, code: string): Promise<LoginData> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/wechat/login",
    ...jsonRequest({
      code,
      deviceKey: `${code}-device-key`,
      deviceName: "Codex Test Device",
      platform: "h5",
    }),
  });

  assert.equal(response.statusCode, 200);

  const body = parseApiResponse<LoginData>(response);

  assert.equal(body.success, true);
  assert.equal(body.data.tokenType, "Bearer");

  return body.data;
}

test("认证安全失败路径会返回稳定错误码", async context => {
  const app = await createMemoryTestApp(context);
  const unauthenticatedResponse = await app.inject({
    method: "GET",
    url: "/api/v1/users/me",
  });
  const unauthenticatedBody = parseApiResponse<null>(unauthenticatedResponse);

  assert.equal(unauthenticatedResponse.statusCode, 401);
  assert.equal(unauthenticatedBody.success, false);
  assert.equal(unauthenticatedBody.code, "UNAUTHORIZED");

  const invalidRefreshResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    ...jsonRequest({
      refreshToken: "invalid-refresh-token",
    }),
  });
  const invalidRefreshBody = parseApiResponse<null>(invalidRefreshResponse);

  assert.equal(invalidRefreshResponse.statusCode, 401);
  assert.equal(invalidRefreshBody.success, false);
  assert.equal(invalidRefreshBody.code, "INVALID_TOKEN");

  const login = await loginWithMockWechat(app, "test-security-failure-paths");
  const logoutResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "POST",
    url: "/api/v1/auth/logout",
  });

  assert.equal(logoutResponse.statusCode, 200);

  const revokedSessionResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/auth/session",
  });
  const revokedSessionBody = parseApiResponse<null>(revokedSessionResponse);

  assert.equal(revokedSessionResponse.statusCode, 401);
  assert.equal(revokedSessionBody.success, false);
  assert.equal(revokedSessionBody.code, "SESSION_REVOKED");
});

test("微信登录接口达到限流阈值后返回 RATE_LIMITED", async context => {
  const app = await createMemoryTestApp(context);

  for (let index = 1; index <= 5; index += 1) {
    await loginWithMockWechat(app, `test-login-rate-limit-${index}`);
  }

  const limitedResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/wechat/login",
    ...jsonRequest({
      code: "test-login-rate-limit-6",
      deviceKey: "test-login-rate-limit-6-device-key",
      deviceName: "Codex Test Device",
      platform: "h5",
    }),
  });
  const limitedBody = parseApiResponse<RateLimitedData>(limitedResponse);

  assert.equal(limitedResponse.statusCode, 429);
  assert.equal(limitedBody.success, false);
  assert.equal(limitedBody.code, "RATE_LIMITED");
  assert.equal(limitedBody.data.retryAfterSeconds > 0, true);
});

test("微信登录后 refresh token 会轮换并废弃旧 token", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-refresh-login");
  const refreshResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    ...jsonRequest({
      refreshToken: login.refreshToken,
    }),
  });

  assert.equal(refreshResponse.statusCode, 200);

  const refreshed = parseApiResponse<RefreshData>(refreshResponse);

  assert.equal(refreshed.data.tokenType, "Bearer");
  assert.notEqual(refreshed.data.refreshToken, login.refreshToken);

  const oldTokenResponse = await app.inject({
    method: "POST",
    url: "/api/v1/auth/refresh",
    ...jsonRequest({
      refreshToken: login.refreshToken,
    }),
  });
  const oldTokenBody = parseApiResponse<null>(oldTokenResponse);

  assert.equal(oldTokenResponse.statusCode, 401);
  assert.equal(oldTokenBody.code, "INVALID_TOKEN");
});

test("重复资料更新会返回首次响应并只写入一条同步日志", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-profile-idempotency");
  const mutationId = "profile-mutation-idempotent";
  const firstResponse = await app.inject({
    method: "POST",
    url: "/api/v1/users/me/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: mutationId,
      payload: {
        nickname: "首次昵称",
      },
    }),
  });
  const secondResponse = await app.inject({
    method: "POST",
    url: "/api/v1/users/me/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: mutationId,
      payload: {
        nickname: "重复昵称",
      },
    }),
  });

  assert.equal(firstResponse.statusCode, 200);
  assert.equal(secondResponse.statusCode, 200);

  const firstBody = parseApiResponse<ProfileData>(firstResponse);
  const secondBody = parseApiResponse<ProfileData>(secondResponse);

  assert.equal(firstBody.data.profile.nickname, "首次昵称");
  assert.equal(secondBody.data.profile.nickname, "首次昵称");

  const syncResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const syncBody = parseApiResponse<SyncChangesData>(syncResponse);
  const profileChanges = syncBody.data.items.filter(item => item.clientMutationId === mutationId);

  assert.equal(syncResponse.statusCode, 200);
  assert.equal(profileChanges.length, 1);
  assert.equal(profileChanges[0]?.entityType, "user_profile");
  assert.equal(profileChanges[0]?.operation, "update");
});

test("经期记录幂等写入、重叠校验和同步水位保持一致", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-period-idempotency");
  const mutationId = "period-mutation-idempotent";
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/v1/cycle/records/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: mutationId,
      payload: {
        clientRecordId: "local-period-001",
        endDate: "2026-05-05",
        intensity: 2,
        moods: ["calm"],
        painLevel: 1,
        startDate: "2026-05-01",
      },
    }),
  });
  const duplicateResponse = await app.inject({
    method: "POST",
    url: "/api/v1/cycle/records/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: mutationId,
      payload: {
        clientRecordId: "local-period-002",
        endDate: "2026-06-05",
        intensity: 3,
        moods: ["busy"],
        painLevel: 2,
        startDate: "2026-06-01",
      },
    }),
  });

  assert.equal(createResponse.statusCode, 200);
  assert.equal(duplicateResponse.statusCode, 200);

  const created = parseApiResponse<PeriodRecordData>(createResponse);
  const duplicated = parseApiResponse<PeriodRecordData>(duplicateResponse);

  assert.equal(duplicated.data.record.id, created.data.record.id);
  assert.equal(duplicated.data.record.clientRecordId, "local-period-001");

  const overlappedResponse = await app.inject({
    method: "POST",
    url: "/api/v1/cycle/records/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "period-mutation-overlapped",
      payload: {
        clientRecordId: "local-period-overlapped",
        endDate: "2026-05-07",
        intensity: 1,
        moods: [],
        painLevel: 0,
        startDate: "2026-05-03",
      },
    }),
  });
  const overlappedBody = parseApiResponse<unknown>(overlappedResponse);

  assert.equal(overlappedResponse.statusCode, 409);
  assert.equal(overlappedBody.code, "CYCLE_RECORD_OVERLAPPED");

  const syncResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const syncBody = parseApiResponse<SyncChangesData>(syncResponse);
  const periodChanges = syncBody.data.items.filter(item => item.entityType === "period_record");

  assert.equal(syncResponse.statusCode, 200);
  assert.equal(periodChanges.length, 1);
  assert.equal(periodChanges[0]?.clientMutationId, mutationId);
  assert.equal(periodChanges[0]?.operation, "create");

  const stateResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/state",
  });
  const stateBody = parseApiResponse<SyncStateData>(stateResponse);

  assert.equal(stateResponse.statusCode, 200);
  assert.equal(stateBody.data.latestVersion, syncBody.data.nextVersion);
});

test("sync/push 可以批量应用当前支持的离线变更", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-sync-push-success");
  const pushResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sync/push",
    ...authJsonRequest(login.accessToken, {
      changes: [
        {
          clientMutationId: "push-profile-update",
          entityType: "user_profile",
          operation: "update",
          payload: {
            nickname: "批量同步昵称",
          },
        },
        {
          clientMutationId: "push-cycle-settings-update",
          entityType: "cycle_settings",
          operation: "update",
          payload: {
            avgCycleLength: 30,
            avgPeriodLength: 6,
            reminderDaysAhead: 2,
            reminderEnabled: true,
            reminderTime: "08:30",
          },
        },
        {
          clientMutationId: "push-period-create",
          entityType: "period_record",
          operation: "create",
          payload: {
            clientRecordId: "push-period-001",
            endDate: "2026-07-04",
            intensity: 2,
            moods: ["steady"],
            painLevel: 1,
            startDate: "2026-07-01",
          },
        },
      ],
    }),
  });
  const pushBody = parseApiResponse<SyncPushData>(pushResponse);

  assert.equal(pushResponse.statusCode, 200);
  assert.equal(pushBody.data.successCount, 3);
  assert.equal(pushBody.data.failedCount, 0);
  assert.equal(pushBody.data.results.every(result => result.success), true);

  const changesResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const changesBody = parseApiResponse<SyncChangesData>(changesResponse);

  assert.equal(changesResponse.statusCode, 200);
  assert.deepEqual(
    changesBody.data.items.map(item => item.clientMutationId),
    ["push-profile-update", "push-cycle-settings-update", "push-period-create"],
  );
  assert.equal(pushBody.data.latestVersion, changesBody.data.nextVersion);
});

test("sync/push 单条失败不会阻断后续变更且重复项返回首次结果", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-sync-push-partial");
  const firstPushResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sync/push",
    ...authJsonRequest(login.accessToken, {
      changes: [
        {
          clientMutationId: "push-period-idempotent",
          entityType: "period_record",
          operation: "create",
          payload: {
            clientRecordId: "push-period-original",
            endDate: "2026-08-05",
            intensity: 2,
            moods: ["ok"],
            painLevel: 1,
            startDate: "2026-08-01",
          },
        },
      ],
    }),
  });
  const firstPushBody = parseApiResponse<SyncPushData>(firstPushResponse);
  const originalRecord = readPeriodRecordFromPushResult(firstPushBody.data.results[0]);
  const secondPushResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sync/push",
    ...authJsonRequest(login.accessToken, {
      changes: [
        {
          clientMutationId: "push-period-idempotent",
          entityType: "period_record",
          operation: "create",
          payload: {
            clientRecordId: "push-period-duplicate",
            endDate: "2026-09-05",
            intensity: 3,
            moods: ["duplicate"],
            painLevel: 2,
            startDate: "2026-09-01",
          },
        },
        {
          clientMutationId: "push-period-overlap",
          entityType: "period_record",
          operation: "create",
          payload: {
            clientRecordId: "push-period-overlap",
            endDate: "2026-08-06",
            intensity: 1,
            moods: [],
            painLevel: 0,
            startDate: "2026-08-03",
          },
        },
        {
          clientMutationId: "push-profile-after-failed-item",
          entityType: "user_profile",
          operation: "update",
          payload: {
            nickname: "失败后仍处理",
          },
        },
      ],
    }),
  });
  const secondPushBody = parseApiResponse<SyncPushData>(secondPushResponse);
  const duplicateRecord = readPeriodRecordFromPushResult(secondPushBody.data.results[0]);

  assert.equal(firstPushResponse.statusCode, 200);
  assert.equal(secondPushResponse.statusCode, 200);
  assert.equal(secondPushBody.data.successCount, 2);
  assert.equal(secondPushBody.data.failedCount, 1);
  assert.equal(duplicateRecord.id, originalRecord.id);
  assert.equal(duplicateRecord.clientRecordId, "push-period-original");
  assert.equal(secondPushBody.data.results[1]?.success, false);
  assert.equal(secondPushBody.data.results[1]?.error?.code, "CYCLE_RECORD_OVERLAPPED");
  assert.equal(secondPushBody.data.results[2]?.success, true);

  const changesResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const changesBody = parseApiResponse<SyncChangesData>(changesResponse);

  assert.deepEqual(
    changesBody.data.items.map(item => item.clientMutationId),
    ["push-period-idempotent", "push-profile-after-failed-item"],
  );
});

test("隐私配置支持读取、切换、幂等、同步日志和审计", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-privacy-config");
  const defaultConfigResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/privacy/config",
  });
  const defaultConfigBody = parseApiResponse<PrivacyConfigData>(defaultConfigResponse);

  assert.equal(defaultConfigResponse.statusCode, 200);
  assert.equal(defaultConfigBody.data.config.storageMode, "plain");
  assert.equal(defaultConfigBody.data.config.cipherAlgorithm, "none");
  assert.equal(defaultConfigBody.data.config.keyVersion, 1);

  const firstUpdateResponse = await app.inject({
    method: "POST",
    url: "/api/v1/privacy/config/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "privacy-config-update-idempotent",
      payload: {
        cipherAlgorithm: "aes-256-gcm",
        e2eeEnabled: true,
        keyVersion: 2,
        recoveryEnabled: true,
        storageMode: "e2ee",
      },
    }),
  });
  const duplicateUpdateResponse = await app.inject({
    method: "POST",
    url: "/api/v1/privacy/config/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "privacy-config-update-idempotent",
      payload: {
        cipherAlgorithm: "none",
        e2eeEnabled: false,
        keyVersion: 1,
        recoveryEnabled: false,
        storageMode: "plain",
      },
    }),
  });
  const firstUpdateBody = parseApiResponse<PrivacyConfigData>(firstUpdateResponse);
  const duplicateUpdateBody = parseApiResponse<PrivacyConfigData>(duplicateUpdateResponse);

  assert.equal(firstUpdateResponse.statusCode, 200);
  assert.equal(duplicateUpdateResponse.statusCode, 200);
  assert.equal(firstUpdateBody.data.config.storageMode, "e2ee");
  assert.equal(firstUpdateBody.data.config.keyVersion, 2);
  assert.equal(duplicateUpdateBody.data.config.storageMode, "e2ee");
  assert.equal(duplicateUpdateBody.data.config.keyVersion, 2);

  const syncResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const syncBody = parseApiResponse<SyncChangesData>(syncResponse);
  const privacyChanges = syncBody.data.items.filter(item => item.entityType === "privacy_config");

  assert.equal(syncResponse.statusCode, 200);
  assert.equal(privacyChanges.length, 1);
  assert.equal(privacyChanges[0]?.operation, "update");
  assert.equal(privacyChanges[0]?.clientMutationId, "privacy-config-update-idempotent");

  const { memoryStore } = await import("../../src/infrastructure/database/memory-store");
  const privacyAuditLogs = memoryStore.auditLogs.filter(log => log.action === "privacy_config.update");

  assert.equal(privacyAuditLogs.length, 1);
  assert.equal(privacyAuditLogs[0]?.metadata.previousStorageMode, "plain");
  assert.equal(privacyAuditLogs[0]?.metadata.storageMode, "e2ee");
});

test("vault item 支持密文托管 upsert、幂等和同步日志", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-vault-item");

  await app.inject({
    method: "POST",
    url: "/api/v1/privacy/config/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "vault-config-e2ee",
      payload: {
        cipherAlgorithm: "xchacha20-poly1305",
        e2eeEnabled: true,
        keyVersion: 3,
        recoveryEnabled: false,
        storageMode: "e2ee",
      },
    }),
  });

  const createResponse = await saveVaultItemViaApi(app, login.accessToken, {
    ciphertext: "ciphertext-v1",
    clientMutationId: "vault-save-create",
    contentHash: "hash-v1",
    keyVersion: 3,
    nonce: "nonce-v1",
  });
  const duplicateResponse = await saveVaultItemViaApi(app, login.accessToken, {
    ciphertext: "ciphertext-duplicate",
    clientMutationId: "vault-save-create",
    contentHash: "hash-duplicate",
    keyVersion: 3,
    nonce: "nonce-duplicate",
  });
  const updateResponse = await saveVaultItemViaApi(app, login.accessToken, {
    ciphertext: "ciphertext-v2",
    clientMutationId: "vault-save-update",
    contentHash: "hash-v2",
    keyVersion: 4,
    nonce: "nonce-v2",
  });
  const createBody = parseApiResponse<VaultItemData>(createResponse);
  const duplicateBody = parseApiResponse<VaultItemData>(duplicateResponse);
  const updateBody = parseApiResponse<VaultItemData>(updateResponse);

  assert.equal(createResponse.statusCode, 200);
  assert.equal(duplicateResponse.statusCode, 200);
  assert.equal(updateResponse.statusCode, 200);
  assert.equal(createBody.data.operation, "create");
  assert.equal(duplicateBody.data.item.id, createBody.data.item.id);
  assert.equal(duplicateBody.data.item.contentHash, "hash-v1");
  assert.equal(updateBody.data.operation, "update");
  assert.equal(updateBody.data.item.id, createBody.data.item.id);
  assert.equal(updateBody.data.item.contentHash, "hash-v2");
  assert.equal(updateBody.data.item.keyVersion, 4);

  const listResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/privacy/vault-items?limit=10",
  });
  const listBody = parseApiResponse<VaultItemsPageData>(listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listBody.data.items.length, 1);
  assert.equal(listBody.data.items[0]?.ciphertext, "ciphertext-v2");

  const syncResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const syncBody = parseApiResponse<SyncChangesData>(syncResponse);
  const vaultChanges = syncBody.data.items.filter(item => item.entityType === "vault_item");

  assert.deepEqual(
    vaultChanges.map(change => change.operation),
    ["create", "update"],
  );
  assert.deepEqual(
    vaultChanges.map(change => change.clientMutationId),
    ["vault-save-create", "vault-save-update"],
  );
});

test("备份快照支持创建、详情、恢复审计和软删除", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-backup-flow");
  const createResponse = await createBackupSnapshotViaApi(app, login.accessToken, {
    clientBackupId: "backup-client-001",
    clientMutationId: "backup-create-001",
    snapshotCiphertext: "ciphertext-001",
    snapshotHash: "hash-001",
  });
  const createBody = parseApiResponse<BackupSnapshotData>(createResponse);
  const duplicateResponse = await createBackupSnapshotViaApi(app, login.accessToken, {
    clientBackupId: "backup-client-duplicate-payload",
    clientMutationId: "backup-create-001",
    snapshotCiphertext: "ciphertext-duplicate",
    snapshotHash: "hash-duplicate",
  });
  const duplicateBody = parseApiResponse<BackupSnapshotData>(duplicateResponse);

  assert.equal(createResponse.statusCode, 200);
  assert.equal(duplicateResponse.statusCode, 200);
  assert.equal(duplicateBody.data.snapshot.id, createBody.data.snapshot.id);
  assert.equal(duplicateBody.data.snapshot.clientBackupId, "backup-client-001");

  const listResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/backups?limit=5",
  });
  const listBody = parseApiResponse<BackupSnapshotsPageData>(listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listBody.data.items.length, 1);
  assert.equal(listBody.data.items[0]?.snapshotHash, "hash-001");

  const detailResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: `/api/v1/backups/detail?id=${createBody.data.snapshot.id}`,
  });
  const detailBody = parseApiResponse<BackupSnapshotDetailData>(detailResponse);

  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailBody.data.snapshot.snapshotCiphertext, "ciphertext-001");

  const restoreResponse = await app.inject({
    method: "POST",
    url: "/api/v1/backups/restore",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "backup-restore-001",
      payload: {
        id: createBody.data.snapshot.id,
      },
    }),
  });
  const restoreBody = parseApiResponse<BackupRestoreData>(restoreResponse);

  assert.equal(restoreResponse.statusCode, 200);
  assert.equal(restoreBody.data.snapshot.id, createBody.data.snapshot.id);
  assert.equal(typeof restoreBody.data.restoredAt, "string");

  const deleteResponse = await app.inject({
    method: "POST",
    url: "/api/v1/backups/delete",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "backup-delete-001",
      payload: {
        id: createBody.data.snapshot.id,
      },
    }),
  });
  const deleteBody = parseApiResponse<BackupDeleteData>(deleteResponse);

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteBody.data.snapshotId, createBody.data.snapshot.id);

  const deletedDetailResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: `/api/v1/backups/detail?id=${createBody.data.snapshot.id}`,
  });
  const deletedDetailBody = parseApiResponse<null>(deletedDetailResponse);

  assert.equal(deletedDetailResponse.statusCode, 404);
  assert.equal(deletedDetailBody.code, "BACKUP_SNAPSHOT_NOT_FOUND");

  const changesResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const changesBody = parseApiResponse<SyncChangesData>(changesResponse);
  const backupChanges = changesBody.data.items.filter(item => item.entityType === "backup_snapshot");

  assert.deepEqual(
    backupChanges.map(change => change.operation),
    ["create", "restore", "delete"],
  );
});

test("备份快照只保留最近 5 条有效记录", async context => {
  const app = await createMemoryTestApp(context);
  const login = await loginWithMockWechat(app, "test-backup-retention");

  for (let index = 1; index <= 6; index += 1) {
    const response = await createBackupSnapshotViaApi(app, login.accessToken, {
      clientBackupId: `backup-retention-${index}`,
      clientMutationId: `backup-retention-create-${index}`,
      snapshotCiphertext: `ciphertext-${index}`,
      snapshotHash: `hash-${index}`,
    });

    assert.equal(response.statusCode, 200);
  }

  const listResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/backups?limit=10",
  });
  const listBody = parseApiResponse<BackupSnapshotsPageData>(listResponse);

  assert.equal(listResponse.statusCode, 200);
  assert.equal(listBody.data.items.length, 5);
  assert.equal(listBody.data.items.some(item => item.clientBackupId === "backup-retention-1"), false);
  assert.equal(listBody.data.items[0]?.clientBackupId, "backup-retention-6");
});

/**
 * 通过 HTTP 创建备份快照。
 *
 * @param app Fastify 测试应用。
 * @param accessToken 后端签发的 access token。
 * @param input 快照测试输入。
 * @returns Fastify inject 响应。
 */
function createBackupSnapshotViaApi(
  app: FastifyInstance,
  accessToken: string,
  input: {
    clientBackupId: string;
    clientMutationId: string;
    snapshotCiphertext: string;
    snapshotHash: string;
  },
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/backups/create",
    ...authJsonRequest(accessToken, {
      clientMutationId: input.clientMutationId,
      payload: {
        algorithm: "aes-256-gcm",
        clientBackupId: input.clientBackupId,
        encrypted: true,
        keyVersion: 1,
        sizeBytes: input.snapshotCiphertext.length,
        snapshotCiphertext: input.snapshotCiphertext,
        snapshotHash: input.snapshotHash,
      },
    }),
  });
}

/**
 * 通过 HTTP 保存端到端加密条目。
 *
 * @param app Fastify 测试应用。
 * @param accessToken 后端签发的 access token。
 * @param input vault item 测试输入。
 * @returns Fastify inject 响应。
 */
function saveVaultItemViaApi(
  app: FastifyInstance,
  accessToken: string,
  input: {
    ciphertext: string;
    clientMutationId: string;
    contentHash: string;
    keyVersion: number;
    nonce: string;
  },
) {
  return app.inject({
    method: "POST",
    url: "/api/v1/privacy/vault-items/save",
    ...authJsonRequest(accessToken, {
      clientMutationId: input.clientMutationId,
      payload: {
        aad: "period-record-aad",
        algorithm: "xchacha20-poly1305",
        ciphertext: input.ciphertext,
        contentHash: input.contentHash,
        entityId: "local-period-vault-001",
        entityType: "period_record",
        keyVersion: input.keyVersion,
        nonce: input.nonce,
      },
    }),
  });
}

/**
 * 从 sync/push 单条成功结果中读取经期记录。
 *
 * @param result 单条批量推送结果。
 * @returns 经期记录精简信息。
 */
function readPeriodRecordFromPushResult(result: SyncPushResultItem | undefined): PeriodRecordData["record"] {
  assert.ok(result);
  assert.equal(result.success, true);

  const data = result.data as PeriodRecordData;

  return data.record;
}
