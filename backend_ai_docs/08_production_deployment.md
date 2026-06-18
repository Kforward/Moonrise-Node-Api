# 08 生产环境部署说明

本文档面向单台云服务器部署：Moonrise Node API、PostgreSQL 和 Nginx 都运行在同一台服务器上。应用进程监听本机 `8000` 端口，Nginx 负责 HTTPS 和反向代理。

## 1. 部署结论

- 生产环境真实配置文件应放在项目根目录 `.env`。当前代码使用 `dotenv.config()`，默认读取 `.env`，不会自动读取 `.env.production`。
- `.env.production.example` 只是可提交的模板。服务器上执行 `cp .env.production.example .env` 后，必须把占位值替换成真实值。
- 生产环境必须使用 `DATABASE_DRIVER=postgresql`，不要使用 `memory`，否则服务重启会丢数据。
- `npm run db:migrate` 正常只执行尚未应用的 Drizzle 迁移，不会清空已有业务数据。
- 禁止在生产库运行 `npm run test:postgres`。PostgreSQL 集成测试会清空业务表，只能连接独立测试库。

## 2. 服务器基础环境

以下命令以 Ubuntu/Debian 系统为例。其他 Linux 发行版可使用等价包管理命令。

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-contrib
```

安装 Node.js 20：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

安装 PM2：

```bash
sudo npm install -g pm2
pm2 -v
```

## 3. 创建生产数据库

进入 PostgreSQL 管理控制台：

```bash
sudo -u postgres psql
```

创建数据库和生产账号。请把密码替换成强随机密码；如果密码包含 `@`、`:`、`/` 等特殊字符，写入 `DATABASE_URL` 时需要 URL encode。

```sql
create database moonrise_prod;
create user moonrise_prod_user with encrypted password 'replace-with-strong-production-password';
grant all privileges on database moonrise_prod to moonrise_prod_user;
```

切换到生产库后授予 schema 权限：

```sql
\c moonrise_prod
grant all on schema public to moonrise_prod_user;
grant all privileges on all tables in schema public to moonrise_prod_user;
grant all privileges on all sequences in schema public to moonrise_prod_user;
alter default privileges in schema public grant all on tables to moonrise_prod_user;
alter default privileges in schema public grant all on sequences to moonrise_prod_user;
\q
```

确认本机连接可用：

```bash
psql "postgresql://moonrise_prod_user:replace-with-strong-production-password@127.0.0.1:5432/moonrise_prod" -c "select 1;"
```

## 4. 拉取代码并配置环境变量

选择部署目录，例如 `/srv/moonrise-node-api`：

```bash
sudo mkdir -p /srv/moonrise-node-api
sudo chown -R $USER:$USER /srv/moonrise-node-api
git clone <your-git-repository-url> /srv/moonrise-node-api
cd /srv/moonrise-node-api
npm install
```

创建真实生产 `.env`：

```bash
cp .env.production.example .env
```

编辑 `.env`：

```bash
nano .env
```

生产环境推荐内容如下，所有 `replace_with_*` 都必须替换：

```env
NODE_ENV=production
APP_HOST=0.0.0.0
APP_PORT=8000
API_PREFIX=/api/v1
CORS_ORIGIN=https://frontend.example.com
LOG_LEVEL=info

DATABASE_DRIVER=postgresql
DATABASE_URL=postgresql://moonrise_prod_user:replace_with_strong_db_password@127.0.0.1:5432/moonrise_prod

JWT_ACCESS_SECRET=replace_with_openssl_rand_base64_48_access_secret
JWT_REFRESH_SECRET=replace_with_openssl_rand_base64_48_refresh_secret

WECHAT_LOGIN_MODE=code2session
WECHAT_MINIPROGRAM_APP_ID=replace_with_wechat_miniprogram_app_id
WECHAT_MINIPROGRAM_APP_SECRET=replace_with_wechat_miniprogram_app_secret
```

生成 JWT 密钥：

```bash
openssl rand -base64 48
openssl rand -base64 48
```

`CORS_ORIGIN` 应填写真实前端 HTTPS 域名，例如 `https://moonrise.example.com`。生产环境不要写 `*`。

## 5. 数据库迁移

首次部署或每次发布包含新迁移时执行：

```bash
npm run db:migrate
```

迁移说明：

- Drizzle Kit 会在数据库中记录已经执行过的迁移；重复运行 `npm run db:migrate` 只会跳过已应用迁移并执行新增迁移。
- 当前仓库已有迁移主要是 `create table`、`create index`、`alter table add constraint`，不会主动清空业务数据。
- 未来如果迁移文件包含 `drop table`、`truncate`、删除字段或重建表，执行前必须先备份数据库并人工审查 SQL。
- `npm run test:postgres` 会通过测试代码清空业务表，只允许对名称包含 `test` 的独立测试库运行，不能用于生产库。

生产库备份示例：

```bash
pg_dump "postgresql://moonrise_prod_user:replace_with_strong_db_password@127.0.0.1:5432/moonrise_prod" \
  > moonrise_prod_$(date +%Y%m%d_%H%M%S).sql
```

## 6. 构建与 PM2 启动

构建 TypeScript：

```bash
npm run build
mkdir -p logs
```

启动服务：

```bash
npm run pm2
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条需要 `sudo` 执行的命令，复制执行它即可让 PM2 随服务器启动。

查看状态和日志：

```bash
pm2 status
pm2 logs moonrise-node-api
```

本机健康检查：

```bash
curl http://127.0.0.1:8000/api/v1/health
```

如果返回 `success: true` 且 `data.status` 为 `ok`，说明 Node 服务已经正常运行。

## 7. Nginx 反向代理

创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/moonrise-node-api
```

示例配置。请把 `api.example.com` 替换成真实 API 域名：

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/moonrise-node-api /etc/nginx/sites-enabled/moonrise-node-api
sudo nginx -t
sudo systemctl reload nginx
```

HTTP 检查：

```bash
curl http://api.example.com/api/v1/health
```

## 8. 配置 HTTPS

推荐使用 Certbot 配置 Let's Encrypt 证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

HTTPS 检查：

```bash
curl https://api.example.com/api/v1/health
```

证书自动续期检查：

```bash
sudo certbot renew --dry-run
```

## 9. 前端联调配置

前端接口基础地址：

```text
https://api.example.com/api/v1
```

接口契约文件：

```text
backend_ai_docs/openapi.json
```

前端可将 `openapi.json` 导入 Apifox、Postman 或 Swagger，再把 server URL 改成线上 API 地址。

微信小程序还需要在微信公众平台配置 request 合法域名：

```text
https://api.example.com
```

注意：微信小程序合法域名只填协议和域名，不包含 `/api/v1` 路径。

## 10. 日常发布流程

进入项目目录：

```bash
cd /srv/moonrise-node-api
```

拉取代码并安装依赖：

```bash
git pull
npm install
```

执行迁移、构建和热重载：

```bash
npm run db:migrate
npm run build
pm2 reload ecosystem.config.js
```

发布后检查：

```bash
pm2 status
curl https://api.example.com/api/v1/health
```

如果健康检查失败，先查看日志：

```bash
pm2 logs moonrise-node-api
```

## 11. 常见问题

### `.env.production.example` 会自动生效吗？

不会。当前应用默认读取项目根目录 `.env`。生产服务器需要复制模板：

```bash
cp .env.production.example .env
```

然后修改 `.env` 中的真实值。

### 数据库迁移会清空已有数据吗？

正常运行 `npm run db:migrate` 不会清空已有业务数据。它会按迁移记录执行尚未应用的迁移。

真正会清空业务表的是 PostgreSQL 集成测试中的重置逻辑，因此不能在生产库运行：

```bash
npm run test:postgres
```

### 生产环境可以使用 mock 微信登录吗？

不可以。`NODE_ENV=production` 时必须使用：

```env
WECHAT_LOGIN_MODE=code2session
```

并配置真实的 `WECHAT_MINIPROGRAM_APP_ID` 与 `WECHAT_MINIPROGRAM_APP_SECRET`。

### API 和数据库在同一台服务器，DATABASE_URL 应该怎么写？

使用本机地址即可：

```env
DATABASE_URL=postgresql://moonrise_prod_user:replace_with_strong_db_password@127.0.0.1:5432/moonrise_prod
```

PostgreSQL 不需要对公网开放端口，只允许本机服务连接更安全。
