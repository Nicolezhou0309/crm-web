# 前端URL配置说明

## 概述

为了方便更换域名，邀请用户功能中的重定向URL已经改为使用环境变量 `FRONTEND_URL`。

## 配置方法

### 方法一：使用 Supabase 控制台（推荐）

1. 打开 [Supabase Functions 页面](https://supabase.com/dashboard/project/wteqgprgiylmxzszcnws/functions)
2. 点击 `invite-user` 函数
3. 在 **Environment Variables** 部分添加：
   - **Key**: `FRONTEND_URL`
   - **Value**: `https://your-domain.com`（你的实际域名）

### 方法二：使用部署脚本

```bash
# 使用默认URL部署
./deploy-invite-user-with-env.sh

# 使用自定义域名部署
./deploy-invite-user-with-env.sh https://your-custom-domain.com
```

## 域名示例

- **Vercel 默认域名**: `https://crm-web-two.vercel.app`
- **自定义域名**: `https://yourcompany.com`
- **本地开发**: `http://localhost:5173`

## 邀请链接格式

设置 `FRONTEND_URL` 后，邀请邮件中的链接格式为：

```
{FRONTEND_URL}/set-password?token=xxx&type=invite
```

例如：
- `https://yourcompany.com/set-password?token=xxx&type=invite`

## 更新域名步骤

1. 在 Supabase 控制台更新 `FRONTEND_URL` 环境变量
2. 重新部署函数（如果需要）：
   ```bash
   supabase functions deploy invite-user
   ```

## 注意事项

- 如果没有设置 `FRONTEND_URL` 环境变量，系统会使用默认值：`https://crm-web-two.vercel.app`
- 修改环境变量后，新发送的邀请邮件会使用新的域名
- 已发送的邀请邮件仍然使用旧域名（需要重新发送邀请） 