import type { FastifyInstance } from "fastify";

/**
 * 注册审计模块路由。
 *
 * 审计模块第一阶段作为内部能力存在，由认证、备份、隐私和同步模块触发写入；
 * 暂不对前端暴露公开接口。
 *
 * @param _app Fastify 应用实例，保留参数便于后续增加受保护的审计查询接口。
 */
export async function registerAuditRoutes(_app: FastifyInstance): Promise<void> {
  // 当前阶段没有公开路由，后续只在有明确前端需求时开放受保护查询接口。
}
