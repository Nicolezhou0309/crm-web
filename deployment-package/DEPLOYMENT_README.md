# CRM Web 部署包

## 部署包内容

- `dist/` - 前端构建文件（React + Vite）
- `backend/` - 后端服务文件（Node.js + Express）

## 部署说明

### 前端部署

前端文件位于 `dist/` 目录，可以直接部署到任何静态文件服务器：

- **Nginx**: 将 `dist/` 目录内容复制到 Nginx 的 web 根目录
- **Apache**: 将 `dist/` 目录内容复制到 Apache 的 DocumentRoot
- **CDN**: 将 `dist/` 目录内容上传到 CDN 服务

### 后端部署

后端服务位于 `backend/` 目录：

1. **安装依赖**:
   ```bash
   cd backend
   npm install
   ```

2. **配置环境变量**:
   创建 `.env` 文件，包含以下配置：
   ```env
   # Supabase 配置
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   VITE_SUPABASE_JWT_SECRET=your_jwt_secret
   
   # 企业微信配置
   WECOM_CORP_ID=your_corp_id
   WECOM_AGENT_ID=your_agent_id
   WECOM_SECRET=your_secret
   WECOM_REDIRECT_URI=your_redirect_uri
   
   # 服务器配置
   PORT=3001
   ```

3. **启动服务**:
   ```bash
   # 开发模式
   npm run dev
   
   # 生产模式
   npm start
   
   # 使用 PM2 管理进程
   pm2 start server.js --name crm-wecom-api
   ```

## 重要更新

### 企业微信登录修复

本次部署包含了企业微信登录的重要修复：

1. **JWT 令牌认证**: 后端现在使用自定义 JWT 令牌替代 magiclink
2. **用户邮箱修复**: 修复了用户已存在时使用临时邮箱的问题
3. **前端简化**: 移除了 signup 链接处理逻辑，直接处理 JWT 令牌

### 修复内容

- ✅ 后端：使用 JWT 令牌替代 magiclink
- ✅ 后端：修复用户邮箱逻辑，使用实际邮箱
- ✅ 前端：简化 WecomAuthManager，处理 JWT 令牌
- ✅ 前端：移除 signup 链接处理逻辑

## 环境要求

- **Node.js**: >= 18.0.0
- **NPM**: >= 8.0.0
- **Supabase**: 需要配置正确的 JWT 密钥

## 部署检查清单

- [ ] 前端文件已部署到静态服务器
- [ ] 后端服务已启动并运行在指定端口
- [ ] 环境变量已正确配置
- [ ] Supabase 连接正常
- [ ] 企业微信配置正确
- [ ] 测试企业微信登录功能

## 故障排除

如果遇到企业微信登录问题：

1. 检查后端日志中的 JWT 令牌生成
2. 验证 Supabase JWT 密钥配置
3. 确认用户邮箱使用实际邮箱而非临时邮箱
4. 检查前端会话设置是否成功

## 联系支持

如有问题，请检查：
- 后端服务日志
- 浏览器控制台错误
- Supabase 连接状态
- 企业微信 API 配置