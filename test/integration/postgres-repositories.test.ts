import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import type { FastifyInstance } from "fastify";
import type { Sql } from "postgres";

process.env.NODE_ENV = "test";
process.env.DATABASE_DRIVER = "postgresql";
process.env.LOG_LEVEL = "silent";
process.env.WECHAT_LOGIN_MODE = "mock";
process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

const shouldRunPostgresTests = process.env.RUN_POSTGRES_TESTS === "1" && Boolean(process.env.DATABASE_URL);
const postgresTest = shouldRunPostgresTests ? test : test.skip;

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
}

interface SyncChangesData {
  items: Array<{
    clientMutationId: string | null;
    entityType: string;
    operation: string;
  }>;
  nextVersion: number;
}

interface BackupSnapshotData {
  snapshot: {
    id: string;
    clientBackupId: string;
    snapshotHash: string;
  };
}

interface VaultItemData {
  item: {
    contentHash: string;
    entityId: string;
  };
  operation: string;
}

postgresTest("PostgreSQL 仓储支持核心业务链路、幂等快照和同步日志", async context => {
  assertSafePostgresTestDatabaseUrl();

  const app = await createPostgresTestApp(context);
  const login = await loginWithMockWechat(app, "postgres-core-flow");

  const profileResponse = await app.inject({
    method: "POST",
    url: "/api/v1/users/me/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-profile-update",
      payload: {
        nickname: "PostgreSQL 用户",
      },
    }),
  });

  assert.equal(profileResponse.statusCode, 200);

  const periodResponse = await app.inject({
    method: "POST",
    url: "/api/v1/cycle/records/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-period-create",
      payload: {
        clientRecordId: "pg-period-001",
        endDate: "2026-06-04",
        intensity: 2,
        moods: ["stable"],
        painLevel: 1,
        startDate: "2026-06-01",
      },
    }),
  });

  assert.equal(periodResponse.statusCode, 200);

  const backupResponse = await app.inject({
    method: "POST",
    url: "/api/v1/backups/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-backup-create",
      payload: {
        algorithm: "aes-256-gcm",
        clientBackupId: "pg-backup-001",
        encrypted: true,
        keyVersion: 1,
        sizeBytes: 16,
        snapshotCiphertext: "pg-ciphertext-001",
        snapshotHash: "pg-hash-001",
      },
    }),
  });
  const backupBody = parseApiResponse<BackupSnapshotData>(backupResponse);

  assert.equal(backupResponse.statusCode, 200);
  assert.equal(backupBody.data.snapshot.clientBackupId, "pg-backup-001");

  const duplicateBackupResponse = await app.inject({
    method: "POST",
    url: "/api/v1/backups/create",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-backup-create",
      payload: {
        algorithm: "aes-256-gcm",
        clientBackupId: "pg-backup-duplicate",
        encrypted: true,
        keyVersion: 1,
        sizeBytes: 20,
        snapshotCiphertext: "pg-ciphertext-duplicate",
        snapshotHash: "pg-hash-duplicate",
      },
    }),
  });
  const duplicateBackupBody = parseApiResponse<BackupSnapshotData>(duplicateBackupResponse);

  assert.equal(duplicateBackupResponse.statusCode, 200);
  assert.equal(duplicateBackupBody.data.snapshot.id, backupBody.data.snapshot.id);
  assert.equal(duplicateBackupBody.data.snapshot.snapshotHash, "pg-hash-001");

  const privacyResponse = await app.inject({
    method: "POST",
    url: "/api/v1/privacy/config/update",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-privacy-update",
      payload: {
        cipherAlgorithm: "xchacha20-poly1305",
        e2eeEnabled: true,
        keyVersion: 3,
        recoveryEnabled: false,
        storageMode: "e2ee",
      },
    }),
  });

  assert.equal(privacyResponse.statusCode, 200);

  const vaultResponse = await app.inject({
    method: "POST",
    url: "/api/v1/privacy/vault-items/save",
    ...authJsonRequest(login.accessToken, {
      clientMutationId: "pg-vault-save",
      payload: {
        aad: "pg-aad",
        algorithm: "xchacha20-poly1305",
        ciphertext: "pg-vault-ciphertext",
        contentHash: "pg-vault-hash",
        entityId: "pg-period-001",
        entityType: "period_record",
        keyVersion: 3,
        nonce: "pg-vault-nonce",
      },
    }),
  });
  const vaultBody = parseApiResponse<VaultItemData>(vaultResponse);

  assert.equal(vaultResponse.statusCode, 200);
  assert.equal(vaultBody.data.operation, "create");
  assert.equal(vaultBody.data.item.contentHash, "pg-vault-hash");

  const changesResponse = await app.inject({
    headers: authHeaders(login.accessToken),
    method: "GET",
    url: "/api/v1/sync/changes?afterVersion=0&limit=20",
  });
  const changesBody = parseApiResponse<SyncChangesData>(changesResponse);

  assert.equal(changesResponse.statusCode, 200);
  assert.deepEqual(
    changesBody.data.items.map(item => `${item.entityType}.${item.operation}`),
    [
      "user_profile.update",
      "period_record.create",
      "backup_snapshot.create",
      "privacy_config.update",
      "vault_item.create",
    ],
  );
  assert.deepEqual(
    changesBody.data.items.map(item => item.clientMutationId),
    [
      "pg-profile-update",
      "pg-period-create",
      "pg-backup-create",
      "pg-privacy-update",
      "pg-vault-save",
    ],
  );
});

/**
 * 创建 PostgreSQL 模式测试应用。
 *
 * 该函数会在用例前后清空业务表，确保仓储测试不会复用上一次运行的数据。调用方必须先
 * 通过 `assertSafePostgresTestDatabaseUrl` 确认目标库是测试库。
 *
 * @param context Node test 当前用例上下文。
 */
async function createPostgresTestApp(context: TestContext): Promise<FastifyInstance> {
  const [{ buildApp }, { closePostgresConnection, getPostgresClient }] = await Promise.all([
    import("../../src/app"),
    import("../../src/infrastructure/database/postgres-client"),
  ]);
  const sql = getPostgresClient();

  await resetPostgresTables(sql);

  const app = await buildApp();

  context.after(async () => {
    await app.close();
    await resetPostgresTables(sql);
    await closePostgresConnection();
  });

  return app;
}

/**
 * 校验 PostgreSQL 集成测试不会误连普通开发库。
 *
 * 当前测试会清空业务表，因此要求显式设置 `RUN_POSTGRES_TESTS=1`，且数据库名称必须包含
 * `test`。例如：`moonrise_test`。
 */
function assertSafePostgresTestDatabaseUrl(): void {
  assert.equal(process.env.RUN_POSTGRES_TESTS, "1");
  assert.ok(process.env.DATABASE_URL, "运行 PostgreSQL 集成测试前必须配置 DATABASE_URL");

  const databaseName = decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//u, ""));

  assert.match(databaseName.toLowerCase(), /test/u, "PostgreSQL 集成测试只能连接名称包含 test 的数据库");
}

/**
 * 清空 PostgreSQL 业务表。
 *
 * 使用 `truncate ... cascade` 是为了覆盖所有模块仓储的真实外键关系；该函数只允许在
 * `assertSafePostgresTestDatabaseUrl` 通过后调用。
 *
 * @param sql postgres.js 客户端。
 */
async function resetPostgresTables(sql: Sql): Promise<void> {
  await sql.unsafe(`
    truncate table
      app_release_entries,
      app_releases,
      audit_logs,
      idempotency_records,
      sync_change_logs,
      backup_snapshots,
      encrypted_vault_items,
      privacy_configs,
      period_records,
      cycle_settings,
      user_app_preferences,
      user_profiles,
      user_devices,
      auth_identities,
      app_users
    restart identity cascade
  `);
}

/**
 * 解析统一 API 响应。
 *
 * @param response Fastify inject 响应。
 */
function parseApiResponse<TData>(response: { body: string }): ApiResponse<TData> {
  return JSON.parse(response.body) as ApiResponse<TData>;
}

/**
 * 构造 JSON 请求参数。
 *
 * @param payload 请求体对象。
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
 */
async function loginWithMockWechat(app: FastifyInstance, code: string): Promise<LoginData> {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/wechat/login",
    ...jsonRequest({
      code,
      deviceKey: `${code}-device-key`,
      deviceName: "PostgreSQL Test Device",
      platform: "h5",
    }),
  });
  const body = parseApiResponse<LoginData>(response);

  assert.equal(response.statusCode, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.tokenType, "Bearer");

  return body.data;
}
