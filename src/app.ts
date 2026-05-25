import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { registerErrorHandler } from "./common/middlewares/error-handler";
import { registerRequestContextHooks } from "./common/middlewares/request-context";
import { appEnv } from "./infrastructure/config/env";
import { getLoggerOptions } from "./infrastructure/logger/logger-options";
import { registerModules } from "./modules";

/**
 * 创建 Fastify 应用实例并注册全局能力。
 *
 * 这里集中处理跨模块能力，例如请求 ID、CORS、统一错误响应和模块路由注册。
 * 业务模块只通过 `registerModules` 接入，不直接修改全局启动流程。
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    genReqId: request => {
      const requestId = request.headers["x-request-id"];

      return typeof requestId === "string" && requestId.length > 0 ? requestId : randomUUID();
    },
    logger: getLoggerOptions(),
  });

  await app.register(cors, {
    origin: appEnv.corsOrigin,
  });

  registerRequestContextHooks(app);
  registerErrorHandler(app);
  await registerModules(app);

  return app;
}
