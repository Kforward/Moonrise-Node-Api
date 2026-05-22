# 01 后端架构设计

## 1. 推荐技术栈

- Runtime：Node.js LTS。
- Language：TypeScript。
- Framework：NestJS 或 Fastify。
- ORM：Prisma 或 Drizzle。
- Database：PostgreSQL。
- Cache / Queue：Redis，可在提醒、异步备份、限流时引入。
- Auth：微信小程序登录 + 后端签发短期 access token 与长期 refresh token。
- Crypto：服务端只做传输层、字段级加密和密文托管；端到端加密密钥不落服务端明文。

## 2. 分层结构

```text
src/
├── common/                 # 底层公共代码，不依赖业务模块
│   ├── constants/
│   ├── errors/
│   ├── guards/
│   ├── interceptors/
│   ├── middlewares/
│   ├── validators/
│   ├── crypto/
│   └── utils/
├── infrastructure/         # 基础设施适配层
│   ├── database/
│   ├── cache/
│   ├── queue/
│   ├── logger/
│   └── config/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── cycle/
│   ├── backup/
│   ├── privacy/
│   ├── sync/
│   └── audit/
├── database/
│   └── migrations/
└── main.ts
```

## 3. 模块职责

- `auth`：微信登录、token 刷新、设备会话、退出登录。
- `users`：用户资料、用户基础偏好。
- `cycle`：周期设置、经期记录、记录冲突校验、删除软删除。
- `backup`：云端快照创建、历史快照列表、恢复记录。
- `privacy`：加密模式、算法、密钥版本、端到端加密元数据。
- `sync`：客户端变更日志、幂等写入、跨设备拉取增量。
- `audit`：安全相关操作和数据恢复审计。

## 4. 关键架构原则

- 页面状态不等于后端模型：后端要存业务实体，不直接存前端组件展示模型。
- 周期预测第一阶段仍由前端计算；后端只保存记录和设置，保证同步后的前端能重新计算。
- 所有写接口必须支持幂等：客户端传 `clientMutationId`，服务端记录并防重复提交。
- 敏感文本字段优先加密：如备注、手机号、邮箱、备份快照。
- 删除采用软删除：经期记录、设备、快照等表保留 `deleted_at`。
- 变更可追踪：重要写操作写入 `sync_change_logs` 或 `audit_logs`。
- 遵循开闭原则：认证、加密、存储、同步冲突处理、通知队列等变化点必须通过接口或适配器扩展，不直接修改核心业务流程。
- 底层公共代码不能反向依赖业务模块；业务模块可以依赖 `common` 与 `infrastructure` 提供的抽象。

## 5. 中间件与横切能力

Node.js 后端中以下能力应优先使用中间件、Guard、Interceptor 或 Hook 实现，不散落在业务函数中：

- 请求 ID 注入：为每个请求生成 `requestId`，贯穿日志和响应。
- 访问日志：记录路径、耗时、状态码，不记录敏感 payload。
- 认证解析：解析 access token，注入 `currentUser` 与 `currentDevice`。
- 权限校验：用户只能访问自己的资源。
- 幂等校验：对写接口读取 `clientMutationId`，防止重复写入。
- 输入校验：DTO/schema 校验请求参数。
- 限流：登录、刷新 token、备份创建等接口必须限流。
- 错误映射：统一业务异常到响应 `code` 与 `message`。
- 响应包装：统一输出通用响应结构。
- 审计触发：安全敏感动作通过拦截器或领域事件写入审计日志。

## 6. 分层开发要求

- `common`：底层公共代码，包括错误、枚举、校验、加密接口、响应类型。
- `infrastructure`：数据库、Redis、队列、日志、配置、第三方 SDK 适配器。
- `modules/*/domain`：业务实体、领域规则、纯函数。
- `modules/*/service`：业务流程编排。
- `modules/*/repository`：数据访问。
- `modules/*/controller`：HTTP 入参出参转换，不写业务规则。
- `modules/*/dto`：请求和响应类型及校验。
