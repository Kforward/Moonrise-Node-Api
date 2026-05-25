import type { FastifyInstance } from "fastify";
import { requireCurrentSession } from "../../common/middlewares/auth-context";
import { buildSuccessResponse } from "../../common/responses/api-response";
import { validateWithZod } from "../../common/validators/validate-with-zod";
import { appEnv } from "../../infrastructure/config/env";
import {
  createPeriodRecord,
  deletePeriodRecord,
  finishPeriodRecord,
  getCycleSettings,
  listPeriodRecords,
  updateCycleSettings,
  updatePeriodRecord,
} from "./cycle.service";
import {
  createPeriodRecordSchema,
  deletePeriodRecordSchema,
  finishPeriodRecordSchema,
  listPeriodRecordsQuerySchema,
  updateCycleSettingsSchema,
  updatePeriodRecordSchema,
} from "./cycle.dto";

/**
 * 注册周期模块路由。
 *
 * 该模块负责周期设置、经期记录、重叠校验、幂等写入和软删除。
 *
 * @param app Fastify 应用实例。
 */
export async function registerCycleRoutes(app: FastifyInstance): Promise<void> {
  const basePath = `${appEnv.apiPrefix}/cycle`;

  app.get(`${basePath}/settings`, async request => {
    const currentSession = requireCurrentSession(request);

    return buildSuccessResponse(request.id, await getCycleSettings(currentSession));
  });

  app.post(`${basePath}/settings/update`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(updateCycleSettingsSchema, request.body);

    return buildSuccessResponse(request.id, await updateCycleSettings(currentSession, input));
  });

  app.get(`${basePath}/records`, async request => {
    const currentSession = requireCurrentSession(request);
    const query = validateWithZod(listPeriodRecordsQuerySchema, request.query);

    return buildSuccessResponse(request.id, await listPeriodRecords(currentSession, query));
  });

  app.post(`${basePath}/records/create`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(createPeriodRecordSchema, request.body);

    return buildSuccessResponse(request.id, await createPeriodRecord(currentSession, input));
  });

  app.post(`${basePath}/records/update`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(updatePeriodRecordSchema, request.body);

    return buildSuccessResponse(request.id, await updatePeriodRecord(currentSession, input));
  });

  app.post(`${basePath}/records/delete`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(deletePeriodRecordSchema, request.body);

    return buildSuccessResponse(request.id, await deletePeriodRecord(currentSession, input));
  });

  app.post(`${basePath}/records/finish`, async request => {
    const currentSession = requireCurrentSession(request);
    const input = validateWithZod(finishPeriodRecordSchema, request.body);

    return buildSuccessResponse(request.id, await finishPeriodRecord(currentSession, input));
  });
}
