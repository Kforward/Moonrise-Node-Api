import type { FastifyInstance } from "fastify";
import { registerPlaceholderRoutes } from "../../common/utils/register-placeholder-routes";
import { appEnv } from "../../infrastructure/config/env";

/**
 * 注册周期模块路由骨架。
 *
 * 该模块是第一阶段核心模块，后续负责周期设置、经期记录、重叠校验和软删除。
 *
 * @param app Fastify 应用实例。
 */
export async function registerCycleRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/cycle`;

  await registerPlaceholderRoutes(app, "cycle", [
    {
      method: "GET",
      nextStep: "读取当前用户的 cycle_settings",
      path: `${basePath}/settings`,
    },
    {
      method: "POST",
      nextStep: "覆盖周期设置并写入 sync_change_logs",
      path: `${basePath}/settings/update`,
    },
    {
      method: "GET",
      nextStep: "游标分页读取 period_records",
      path: `${basePath}/records`,
    },
    {
      method: "POST",
      nextStep: "校验 clientMutationId 和日期区间后创建 period_records",
      path: `${basePath}/records/create`,
    },
    {
      method: "POST",
      nextStep: "校验记录归属、重叠区间和幂等键后更新记录",
      path: `${basePath}/records/update`,
    },
    {
      method: "POST",
      nextStep: "对经期记录执行软删除并写入同步日志",
      path: `${basePath}/records/delete`,
    },
    {
      method: "POST",
      nextStep: "补充进行中记录的结束日期并执行重叠校验",
      path: `${basePath}/records/finish`,
    },
  ]);
}
