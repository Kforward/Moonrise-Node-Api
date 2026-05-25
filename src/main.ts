import { buildApp } from "./app";
import { appEnv } from "./infrastructure/config/env";

/**
 * 启动后端 HTTP 服务。
 *
 * 该入口只负责进程级启动与失败退出，具体中间件、路由和错误处理都在 `buildApp`
 * 中完成，避免后续业务模块直接依赖进程启动细节。
 */
async function bootstrap(): Promise<void> {
  const app = await buildApp();

  await app.listen({
    host: appEnv.host,
    port: appEnv.port,
  });
}

bootstrap().catch((error: unknown) => {
  console.error("Moonrise 后端服务启动失败", error);
  process.exit(1);
});
