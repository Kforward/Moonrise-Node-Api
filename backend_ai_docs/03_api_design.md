# 03 API 设计草案

> 前端联调请优先使用 `backend_ai_docs/openapi.json`。该 OpenAPI 文件按当前代码中的路由、DTO 和公开响应结构维护，可直接导入 Apifox、Postman 或 Swagger；本文档主要保留业务说明、接口分组和设计约束。

## 1. 通用响应

后端接口只使用 `GET` 与 `POST`：

- `GET`：只用于读取数据，不产生业务写入。
- `POST`：用于新增、更新、删除、恢复、刷新 token 等所有会产生状态变化的动作。
- 不使用 `PUT`、`PATCH`、`DELETE`。需要表达动作时，在路径中使用明确动词，例如 `/update`、`/delete`、`/restore`。

```json
{
  "success": true,
  "code": "OK",
  "message": "success",
  "data": {},
  "requestId": "req_xxx"
}
```

错误响应：

```json
{
  "success": false,
  "code": "CYCLE_RECORD_OVERLAPPED",
  "message": "这段日期已存在记录，请换一个区间",
  "data": {
    "conflictRecordId": "..."
  },
  "requestId": "req_xxx"
}
```

## 2. 应用级接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/app/preferences` | 获取当前用户轻量偏好 |
| `POST` | `/api/v1/app/preferences/update` | 更新首页提示、空状态引导等轻量偏好 |
| `GET` | `/api/v1/app/releases` | 分页获取已发布应用更新日志 |
| `GET` | `/api/v1/app/releases/detail` | 按版本号获取已发布应用更新日志详情 |

`/app/preferences/update` 必须包含 `clientMutationId`，并会写入 `user_app_preferences.update` 同步日志。应用更新日志只返回 `published=true` 的版本，不需要登录态。

## 3. 认证接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/v1/auth/wechat/login` | 微信小程序登录，换取后端 token |
| `POST` | `/api/v1/auth/refresh` | 刷新 access token |
| `POST` | `/api/v1/auth/logout` | 当前设备退出 |
| `GET` | `/api/v1/auth/session` | 获取当前会话与设备状态 |

`/auth/wechat/login` 在生产环境调用微信 `jscode2session`，用 `openid` 绑定后端账号；开发环境可通过 `WECHAT_LOGIN_MODE=mock` 保留本地联调。微信 `session_key` 只在登录解析阶段使用，不落库、不返回前端。

## 4. 用户资料

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/users/me` | 获取当前用户资料 |
| `POST` | `/api/v1/users/me/update` | 更新昵称、头像、性别、联系方式 |
| `GET` | `/api/v1/users/me/devices` | 获取已绑定设备 |
| `POST` | `/api/v1/users/me/devices/revoke` | 注销设备 |

## 5. 周期设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/cycle/settings` | 获取周期设置 |
| `POST` | `/api/v1/cycle/settings/update` | 覆盖周期设置 |

## 6. 周期记录

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/cycle/records` | 分页获取周期记录 |
| `POST` | `/api/v1/cycle/records/create` | 新增记录 |
| `POST` | `/api/v1/cycle/records/update` | 编辑记录 |
| `POST` | `/api/v1/cycle/records/delete` | 软删除记录 |
| `POST` | `/api/v1/cycle/records/finish` | 补充正在进行记录的结束日期 |

写入请求必须包含：

```json
{
  "clientMutationId": "uuid-from-client",
  "payload": {}
}
```

## 7. 同步接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/sync/changes?afterVersion=0` | 拉取增量变更 |
| `POST` | `/api/v1/sync/push` | 批量推送离线变更 |
| `GET` | `/api/v1/sync/state` | 获取服务器同步水位 |

`/sync/push` 当前支持批量提交已落地的 `user_profile.update`、`user_app_preferences.update`、`cycle_settings.update`、`privacy_config.update`、`vault_item.create/update` 和 `period_record.create/update/delete/finish`。请求示例：

```json
{
  "changes": [
    {
      "clientMutationId": "uuid-from-client",
      "entityType": "period_record",
      "operation": "create",
      "payload": {
        "clientRecordId": "local-id",
        "startDate": "2026-07-01",
        "endDate": "2026-07-04",
        "intensity": 2,
        "painLevel": 1,
        "moods": []
      }
    }
  ]
}
```

服务端会逐条复用业务接口校验、幂等和同步日志写入；单条失败不会阻断后续变更，响应中的 `results` 会标记每条是否成功，并返回最新同步水位。

## 8. 备份接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/backups` | 获取云端快照列表 |
| `POST` | `/api/v1/backups/create` | 创建云端快照 |
| `GET` | `/api/v1/backups/detail` | 获取快照密文 |
| `POST` | `/api/v1/backups/restore` | 标记并审计一次恢复 |
| `POST` | `/api/v1/backups/delete` | 删除快照 |

创建备份快照请求示例：

```json
{
  "clientMutationId": "uuid-from-client",
  "payload": {
    "clientBackupId": "local-backup-id",
    "encrypted": true,
    "algorithm": "aes-256-cbc-hmac-sha256",
    "keyVersion": 1,
    "sizeBytes": 1024,
    "snapshotCiphertext": "encrypted-payload",
    "snapshotHash": "sha256-or-client-hash"
  }
}
```

列表接口只返回元数据，详情接口才返回 `snapshotCiphertext`。服务端第一阶段保留最近 5 条有效快照；创建、恢复、删除都会写入审计日志和同步日志。

当前小程序端云端备份默认上传客户端自持密钥的 `aes-256-cbc-hmac-sha256` 密文信封；服务端只校验算法枚举、密文和摘要字段，不保存明文密钥，也不解密快照内容。

## 9. 隐私安全接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/privacy/config` | 获取云端隐私配置 |
| `POST` | `/api/v1/privacy/config/update` | 更新加密模式、算法、密钥版本 |
| `POST` | `/api/v1/privacy/vault-items/save` | 保存端到端加密条目 |
| `GET` | `/api/v1/privacy/vault-items` | 拉取端到端加密条目 |

## 10. 分页规则

- 列表接口默认 `limit=20`，最大 `limit=100`。
- 使用游标分页：`cursor` 为上一页最后一条记录的 `createdAt + id` 编码。
- 返回：

```json
{
  "items": [],
  "nextCursor": null
}
```
