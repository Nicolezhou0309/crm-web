# CRM系统部署指南

## 部署到Vercel（推荐）

### 1. 准备工作

确保您已经安装了Vercel CLI：
```bash
npm install -g vercel
```

### 2. 部署步骤

1. **登录Vercel**：
```bash
vercel login
```

2. **部署应用**：
```bash
vercel
```

3. **设置环境变量**：
在Vercel控制台中设置以下环境变量：
- `VITE_SUPABASE_URL`: http://47.123.26.25:8000
- `VITE_SUPABASE_ANON_KEY`: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI8MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE

⚠️ **混合内容警告**: 使用HTTP的Supabase URL在HTTPS环境中会出现错误。请参考 [混合内容错误修复指南](../MIXED_CONTENT_ERROR_FIX.md)

### 3. 更新Edge Function

部署完成后，您会得到一个域名（例如：`https://your-app.vercel.app`）。

然后需要更新Edge Function中的重定向URL：

1. 修改 `supabase/functions/invite-user/index.ts` 中的重定向URL
2. 将 `https://your-app.vercel.app/set-password` 替换为您的实际域名
3. 重新部署Edge Function：
```bash
supabase functions deploy invite-user
```

### 4. 验证部署

1. 访问您的Vercel域名
2. 测试用户邀请功能
3. 确认邮件中的链接能正确重定向到密码设置页面

## 其他部署选项

### Netlify部署

1. 构建项目：
```bash
npm run build
```

2. 将 `dist` 文件夹部署到Netlify

### GitHub Pages部署

1. 修改 `vite.config.ts`：
```typescript
export default defineConfig({
  base: '/your-repo-name/',
  // ... 其他配置
})
```

2. 使用GitHub Actions自动部署

## 环境变量配置

确保在生产环境中正确设置以下环境变量：

- `VITE_SUPABASE_URL`: http://47.123.26.25:8000
- `VITE_SUPABASE_ANON_KEY`: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE

⚠️ **混合内容问题**: 当前Supabase服务器仅支持HTTP，在HTTPS部署中会遇到问题。详见 [混合内容错误修复指南](./MIXED_CONTENT_ERROR_FIX.md)

## 注意事项

1. **HTTPS**: 生产环境必须使用HTTPS
2. **域名**: 确保重定向URL使用正确的域名
3. **环境变量**: 不要在代码中硬编码敏感信息
4. **CORS**: 确保Supabase项目允许您的域名访问

## 故障排除

### 常见问题

1. **重定向失败**: 检查Edge Function中的重定向URL是否正确
2. **环境变量未加载**: 确保在Vercel中正确设置了环境变量
3. **CORS错误**: 在Supabase控制台中添加您的域名到允许列表

### 调试步骤

1. 检查浏览器控制台错误
2. 查看Vercel部署日志
3. 检查Supabase Edge Function日志
4. 验证邮件中的链接格式 