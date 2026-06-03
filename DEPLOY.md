# 部署说明

## 1. Supabase

1. 创建一个 Supabase 项目。
2. 打开 SQL Editor。
3. 复制并运行 `supabase/schema.sql` 的全部内容。
4. 打开 Project Settings -> API，准备好项目 URL 和 secret/service role key。

## 2. GitHub

把这个文件夹里的所有文件作为 GitHub 仓库根目录上传。

仓库根目录应该能直接看到：

```text
src/
netlify/functions/
supabase/schema.sql
package.json
netlify.toml
README.md
```

## 3. Netlify

1. 在 Netlify 新建站点。
2. 选择从 GitHub 导入。
3. 选择这个仓库。
4. 保持构建配置：

```text
npm run build
dist
```

5. 添加环境变量：

```text
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SECRET_KEY=你的 Supabase secret key 或 service_role key
APP_ACCESS_PASSWORD=团队访问密码
SESSION_SECRET=一段很长的随机字符串
```

## 4. 验收

1. 打开 Netlify 网址。
2. 输入团队访问密码。
3. 新增一个客户和订单。
4. 换另一个浏览器输入同一个团队密码，刷新后应能看到同一份数据。
