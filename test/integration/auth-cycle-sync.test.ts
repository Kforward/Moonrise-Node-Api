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
