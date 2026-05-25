import type { FastifyInstance } from "fastify";
import { createNotImplementedHandler } from "../handlers/not-implemented-handler";

export interface PlaceholderRoute {
  method: "GET" | "POST";
  path: string;
  nextStep: string;
}

/**
 * 批量注册模块占位路由。
 *
 * 该工具只允许 `GET` 和 `POST`，用于落实后端文档中“不使用 PUT/PATCH/DELETE”的规则。
 *
 * @param app Fastify 应用实例。
 * @param moduleName 模块名称。
 * @param routes 待注册的占位路由配置。
 */
export async function registerPlaceholderRoutes(
  app: FastifyInstance,
  moduleName: string,
  routes: PlaceholderRoute[],
): Promise<void> {
  for (const route of routes) {
    app.route({
      handler: createNotImplementedHandler(moduleName, route.nextStep),
      method: route.method,
      url: route.path,
    });
  }
}
