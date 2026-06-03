# 客户回访管理系统

这是 GitHub + Netlify + Supabase 的团队共享密码版。

## 特点

- 不需要管理员账号，也不需要销售个人账号。
- 团队成员打开 Netlify 网址后，输入同一个团队访问密码即可使用。
- 客户、订单、沟通记录、设置字典统一保存在 Supabase。
- 浏览器不直接访问 Supabase 数据库；所有数据请求都经过 Netlify Functions。

## 部署步骤

1. 在 Supabase 创建项目。
2. 打开 Supabase SQL Editor，运行 `supabase/schema.sql` 的全部内容。
3. 把本项目上传到 GitHub 仓库。
4. 在 Netlify 选择该 GitHub 仓库部署。
5. 在 Netlify 环境变量里添加：

```text
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SECRET_KEY=你的 Supabase secret key 或 service_role key
APP_ACCESS_PASSWORD=团队访问密码
SESSION_SECRET=一段很长的随机字符串
```

## Netlify 构建配置

Netlify 会自动读取 `netlify.toml`：

```text
Build command: npm run build
Publish directory: dist
Node version: 20
```

## 重要提醒

- 不要把真实 `.env` 文件上传到 GitHub。
- `SUPABASE_SECRET_KEY` 只能放在 Netlify 环境变量里，不能写进前端代码。
- 如果团队密码泄露，修改 Netlify 的 `APP_ACCESS_PASSWORD`；如果要让旧登录立即失效，同时修改 `SESSION_SECRET`。
