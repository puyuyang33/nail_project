# 在 Vercel 上完整部署 Lunaria

本指南的目标是部署一个可真实使用的版本：Google 登录、商品和库存、
Stripe 支付、多人预约审批、图片上传、邮件通知、限流以及可选的 MongoDB
内容编辑均可工作。

## 1. 服务清单与推荐免费方案

| 功能          | 推荐服务           | 是否必需 | 免费起步                                |
| ------------- | ------------------ | -------- | --------------------------------------- |
| 应用托管      | Vercel             | 是       | Hobby                                   |
| 事务数据库    | Neon PostgreSQL    | 是       | Free                                    |
| Google 登录   | Google Cloud OAuth | 是       | 免费                                    |
| 商品/订金支付 | Stripe             | 是       | 无月费，按交易收费                      |
| 图片          | Cloudinary         | 是       | Free                                    |
| 邮件          | Resend             | 是       | Free 配额；生产需验证自有域名           |
| 分布式限流    | Upstash Redis      | 生产必需 | Free                                    |
| 灵活内容文档  | MongoDB Atlas      | 可选     | M0 Free                                 |
| 小时级提醒    | GitHub Actions     | 推荐     | 公共仓库免费；私有仓库消耗 Actions 分钟 |

免费层适合测试、小规模营业和上线验证。涉及真实付款和客户预约后，应监控
额度、连接数、备份和服务条款，并在流量增长前升级。

## 2. 先推送到 GitHub

在 GitHub 创建一个**空仓库**，不要预先创建 README，然后在项目 worktree
目录运行：

```powershell
Set-Location "C:\path\to\your\cloned\nail-template"
git status
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git push -u origin HEAD:main
```

GitHub 的默认分支设为 `main`。Vercel 和定时 GitHub Actions 都以默认分支为准。

## 3. 创建 Neon PostgreSQL

可从 Neon 控制台创建，也可稍后通过 Vercel Marketplace 连接。选择靠近 Vercel
函数的区域。

Neon 通常提供：

- `DATABASE_URL`：池化连接，给 Vercel 运行时使用；
- `DATABASE_URL_UNPOOLED`：直连，给 Prisma migration/seed 使用。

先把两个 URL 暂时设置到本机 PowerShell：

```powershell
$env:DATABASE_URL = "NEON_POOLED_URL"
$env:DATABASE_URL_UNPOOLED = "NEON_UNPOOLED_URL"
```

安装、迁移并确认状态：

```powershell
npm ci
npm run db:migrate:deploy
npx prisma migrate status
```

迁移会启用 `btree_gist` 并创建防止已接受预约重叠的 exclusion constraint。
Neon 支持该扩展。

### 初始化产品、服务和管理员

管理员邮箱应与之后 Google 登录的邮箱完全一致：

```powershell
$env:SEED_ADMIN_EMAIL = "YOUR_GOOGLE_EMAIL"
$env:SEED_ADMIN_PASSWORD = "A-ONE-TIME-STRONG-PASSWORD-123!"
$env:SEED_ADMIN_NAME = "Owner"
$env:SEED_DEMO_DATA = "false"
npm run db:seed
Remove-Item Env:SEED_ADMIN_EMAIL, Env:SEED_ADMIN_PASSWORD, Env:SEED_ADMIN_NAME, Env:SEED_DEMO_DATA
```

密码认证默认关闭，因此一次性 seed 密码不会出现在登录界面。Google 会按同一
verified email 安全链接现有管理员记录。

## 4. 配置 Google OAuth

在 Google Cloud Console 创建 **Web application** OAuth Client。

假设 Vercel 项目名为 `lunaria-nails`，添加：

```text
Authorized JavaScript origins
https://lunaria-nails.vercel.app

Authorized redirect URIs
https://lunaria-nails.vercel.app/api/auth/callback/google
```

本地测试同时添加：

```text
http://localhost:3000
http://localhost:3000/api/auth/callback/google
```

Google 不接受随机 Preview URL 通配符。Preview 环境可暂时不测试 OAuth，或为
固定 Preview 域名单独添加 callback。

生成 Auth.js secret：

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

保存：

```dotenv
AUTH_SECRET=生成的随机值
AUTH_GOOGLE_ID=Google Client ID
AUTH_GOOGLE_SECRET=Google Client Secret
AUTH_GOOGLE_ADMIN_EMAILS=YOUR_GOOGLE_EMAIL
AUTH_CREDENTIALS_ENABLED=false
AUTH_PASSWORD_REGISTRATION_ENABLED=false
```

## 5. 配置 Stripe

先用 Test Mode：

1. 创建 Stripe 账号；
2. 复制 `sk_test_...` 为 `STRIPE_SECRET_KEY`；
3. 创建 Webhook：

```text
https://lunaria-nails.vercel.app/api/stripe/webhook
```

订阅：

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
```

复制 endpoint signing secret：

```dotenv
STRIPE_WEBHOOK_SECRET=whsec_...
```

产品结账会使用 Stripe。预约订金可先关闭：

```dotenv
APPOINTMENT_DEPOSITS_ENABLED=false
```

当 Stripe 测试支付、Webhook 和退款流程验证完毕，再改为 `true`。测试卡号：
`4242 4242 4242 4242`。

## 6. 配置 Cloudinary

创建 Cloudinary cloud，设置：

```dotenv
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

管理员可上传产品、系列和服务图片。建议限制为 JPEG/PNG/WebP/AVIF、最大
4 MB，并使用 `lunaria/products` 文件夹。

## 7. 配置 Resend 邮件和手机通知

生产环境需要在 Resend 验证你拥有的域名，并设置：

```dotenv
RESEND_API_KEY=re_...
EMAIL_FROM=Lunaria Nail Atelier <appointments@YOUR_DOMAIN>
APPOINTMENT_NOTIFICATION_EMAILS=YOUR_GMAIL,FRONT_DESK_EMAIL
```

管理员 Google 邮箱也会自动加入预约通知收件人。打开 Gmail 手机 App
通知后，新预约请求会形成免费的手机推送。员工在后台配置自己的 email 后，
接受/分配预约时会收到邮件和 Google Calendar 添加链接。

## 8. 配置 Upstash Redis

从 Vercel Marketplace 安装 Upstash Redis，或从 Upstash 控制台创建。项目需要：

```dotenv
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

生产模式缺少 Upstash 会主动失败，避免把单进程内存限流误当成生产保护。

## 9. 可选 MongoDB Atlas

如需后台编辑 About、FAQ、政策等嵌套内容，创建 Atlas M0，然后设置：

```dotenv
NOSQL_PROVIDER=mongodb
MONGODB_URI=mongodb+srv://...
MONGODB_DATABASE=lunaria
NOSQL_EVENT_RETENTION_DAYS=90
```

在本机临时设置生产 URI 后运行：

```powershell
npm run nosql:setup
```

若暂时不需要内容编辑：

```dotenv
NOSQL_PROVIDER=disabled
```

商品、订单、库存、员工和预约仍完全使用 PostgreSQL，不受影响。

## 10. 在 Vercel 创建项目

1. Vercel → **Add New Project**；
2. Import GitHub 仓库；
3. Framework 选择 Next.js；
4. Root Directory 保持仓库根目录；
5. Build Command 使用 `npm run build`；
6. Install Command 使用 `npm ci`；
7. Node.js 选择 22；
8. 在首次 Deploy 前添加 Production 环境变量。

### Production 环境变量

```dotenv
DATABASE_URL=NEON_POOLED_URL
DATABASE_URL_UNPOOLED=NEON_UNPOOLED_URL
NEXT_PUBLIC_APP_URL=https://lunaria-nails.vercel.app
AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GOOGLE_ADMIN_EMAILS=...
AUTH_CREDENTIALS_ENABLED=false
AUTH_PASSWORD_REGISTRATION_ENABLED=false
STRIPE_SECRET_KEY=sk_test_...或sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
RESEND_API_KEY=re_...
EMAIL_FROM=Lunaria Nail Atelier <appointments@YOUR_DOMAIN>
APPOINTMENT_NOTIFICATION_EMAILS=YOUR_GMAIL
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
CRON_SECRET=另一个至少32字符的随机值
BUSINESS_TIMEZONE=America/Chicago
STORE_CURRENCY=USD
APPOINTMENT_DEPOSITS_ENABLED=false
NOSQL_PROVIDER=disabled
SKIP_ENV_VALIDATION=false
```

不要把 `SEED_ADMIN_PASSWORD` 或任何生产密钥提交到 Git。

## 11. 免费层的预约提醒

Vercel Hobby Cron 只能每日运行。仓库中的 `vercel.json` 提供每日兜底。

小时级提醒使用 `.github/workflows/appointment-reminders.yml`。在 GitHub
Repository → Settings → Secrets and variables → Actions 添加：

```text
APP_URL=https://lunaria-nails.vercel.app
CRON_SECRET=与Vercel完全相同的值
```

该 workflow 每小时调用：

```text
GET /api/cron/appointment-reminders
Authorization: Bearer CRON_SECRET
```

## 12. 自定义域名

添加域名后：

1. 把 `NEXT_PUBLIC_APP_URL` 改为正式 HTTPS 域名；
2. Google OAuth 添加新的 origin 和 callback；
3. Stripe 创建/更新正式域名 Webhook；
4. GitHub `APP_URL` secret 改为正式域名；
5. 重新部署。

保留 `.vercel.app` callback 一段时间，直到正式域名验证结束。

## 13. 上线验证

按顺序检查：

```text
/api/health
/en
/zh
/en/login
/en/shop
/en/book
/en/admin
/en/admin/calendar
/en/admin/staff
/en/admin/products
/en/admin/services
```

完成一次真实流程：

1. Google 管理员登录；
2. 创建员工、服务、系列和产品并上传图片；
3. 客户提交预约；
4. 管理员 Gmail 收到通知；
5. 管理员接受并分配员工；
6. 客户和员工收到邮件；
7. 公共日历显示该员工忙碌；
8. 完成 Stripe 测试商品支付；
9. 确认订单、库存、Webhook 和邮件；
10. 手动运行 GitHub Appointment reminders workflow。

## 14. 后续发布

普通代码更新：

```powershell
git push origin main
```

包含数据库 migration 的更新：

```powershell
$env:DATABASE_URL = "NEON_POOLED_URL"
$env:DIRECT_URL = "NEON_UNPOOLED_URL"
npm run db:migrate:deploy
git push origin main
```

先迁移、后部署。不要在每个 Vercel Build 内并发运行 migration。

## 15. 最低生产建议

虽然所有核心服务都能从免费层起步，但真实营业至少应具备：

- PostgreSQL 自动备份或定期导出；
- 自有域名和 Resend SPF/DKIM/DMARC；
- Google 管理员账户 MFA；
- Stripe Live Mode 业务验证；
- Vercel/Stripe/Resend/Neon 日志监控；
- 定期运行 `npm audit` 和 `npx prisma migrate status`。
