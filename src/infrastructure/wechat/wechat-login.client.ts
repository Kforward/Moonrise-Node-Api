import { AppError } from "../../common/errors/app-error";
import { ERROR_CODES } from "../../common/errors/error-codes";
import { appEnv } from "../config/env";

const WECHAT_CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const WECHAT_AUTHORIZATION_CODE_GRANT = "authorization_code";
const WECHAT_REQUEST_TIMEOUT_MS = 5000;

interface WechatCode2SessionResponse {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export interface WechatSessionIdentity {
  /** 微信小程序 openid，用作后端第三方身份绑定主体。 */
  openId: string;
  /** 微信开放平台 unionid，未绑定开放平台时可能为空。 */
  unionId: string | null;
}

/**
 * 根据小程序登录 code 解析微信身份。
 *
 * 开发环境默认允许 mock 模式，便于前端和后端在没有微信配置时继续联调；当配置
 * `WECHAT_LOGIN_MODE=code2session` 或生产环境启动时，会调用微信官方 `jscode2session`
 * 接口换取 openid。微信 `session_key` 只参与本次解析，不落库也不返回给前端。
 *
 * @param code 前端 `wx.login` 获取的一次性登录 code。
 * @returns 可用于后端账号绑定的微信身份。
 */
export async function resolveWechatSessionIdentity(code: string): Promise<WechatSessionIdentity> {
  if (appEnv.wechatLoginMode === "mock") {
    return resolveMockWechatIdentity(code);
  }

  return resolveCode2SessionIdentity(code);
}

/**
 * 构造开发期微信 mock 身份。
 *
 * @param code 前端传入的登录 code。
 * @returns 使用 code 派生的稳定 mock 身份。
 */
function resolveMockWechatIdentity(code: string): WechatSessionIdentity {
  return {
    openId: code,
    unionId: null,
  };
}

/**
 * 调用微信 `jscode2session` 接口解析真实小程序身份。
 *
 * @param code 前端 `wx.login` 获取的一次性登录 code。
 * @returns 微信返回的 openid 和可选 unionid。
 */
async function resolveCode2SessionIdentity(code: string): Promise<WechatSessionIdentity> {
  const appId = requireWechatConfig(appEnv.wechatMiniProgramAppId, "WECHAT_MINIPROGRAM_APP_ID");
  const appSecret = requireWechatConfig(appEnv.wechatMiniProgramAppSecret, "WECHAT_MINIPROGRAM_APP_SECRET");
  const url = buildCode2SessionUrl(appId, appSecret, code);
  const response = await requestWechatCode2Session(url);

  if (response.errcode) {
    throw new AppError({
      code: ERROR_CODES.WECHAT_LOGIN_FAILED,
      data: {
        errcode: response.errcode,
      },
      message: "微信登录凭证校验失败，请重新登录",
      statusCode: 401,
    });
  }

  if (!response.openid) {
    throw new AppError({
      code: ERROR_CODES.WECHAT_LOGIN_FAILED,
      message: "微信登录未返回 openid",
      statusCode: 502,
    });
  }

  return {
    openId: response.openid,
    unionId: response.unionid ?? null,
  };
}

/**
 * 读取必需的微信配置。
 *
 * @param value 已解析的环境变量值。
 * @param name 环境变量名称。
 * @returns 非空配置值。
 */
function requireWechatConfig(value: string | null, name: string): string {
  if (!value) {
    throw new AppError({
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: `${name} 未配置，无法完成微信登录`,
      statusCode: 500,
    });
  }

  return value;
}

/**
 * 构造微信 `jscode2session` 请求地址。
 *
 * @param appId 微信小程序 appid。
 * @param appSecret 微信小程序 secret。
 * @param code 前端登录 code。
 * @returns 已完成查询参数编码的请求 URL。
 */
function buildCode2SessionUrl(appId: string, appSecret: string, code: string): string {
  const url = new URL(WECHAT_CODE2SESSION_URL);
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", WECHAT_AUTHORIZATION_CODE_GRANT);

  return url.toString();
}

/**
 * 带超时调用微信登录接口。
 *
 * @param url 微信 `jscode2session` 完整请求地址。
 * @returns 微信返回的 JSON 响应。
 */
async function requestWechatCode2Session(url: string): Promise<WechatCode2SessionResponse> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), WECHAT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new AppError({
        code: ERROR_CODES.WECHAT_LOGIN_FAILED,
        message: "微信登录服务暂时不可用",
        statusCode: 502,
      });
    }

    return await parseWechatResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      code: ERROR_CODES.WECHAT_LOGIN_FAILED,
      message: "微信登录服务请求失败",
      statusCode: 502,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 解析微信登录 JSON 响应。
 *
 * @param response fetch 返回的 HTTP 响应对象。
 * @returns 已转换为对象的微信响应。
 */
async function parseWechatResponse(response: Response): Promise<WechatCode2SessionResponse> {
  const payload: unknown = await response.json();

  if (!isWechatCode2SessionResponse(payload)) {
    throw new AppError({
      code: ERROR_CODES.WECHAT_LOGIN_FAILED,
      message: "微信登录服务返回格式异常",
      statusCode: 502,
    });
  }

  return payload;
}

/**
 * 判断未知 JSON 是否符合微信登录响应结构。
 *
 * @param payload 待校验的 JSON。
 * @returns 是否可以按微信登录响应继续处理。
 */
function isWechatCode2SessionResponse(payload: unknown): payload is WechatCode2SessionResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  return (
    isOptionalString(candidate.openid)
    && isOptionalString(candidate.session_key)
    && isOptionalString(candidate.unionid)
    && isOptionalNumber(candidate.errcode)
    && isOptionalString(candidate.errmsg)
  );
}

/**
 * 判断字段是否为可选字符串。
 *
 * @param value 待校验字段值。
 * @returns 字段缺失或为字符串时返回 `true`。
 */
function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

/**
 * 判断字段是否为可选数字。
 *
 * @param value 待校验字段值。
 * @returns 字段缺失或为数字时返回 `true`。
 */
function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === "number";
}
