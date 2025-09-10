# CRM Web 后端部署包

## 部署包内容

- Node.js 服务器文件
- 企业微信登录修复
- JWT 令牌认证实现
- 完整的依赖配置

## 部署说明

### 1. 解压文件
```bash
tar -xzf crm-web-backend-*.tar.gz
cd backend
```

### 2. 安装依赖
```bash
# 如果服务器没有 node_modules，需要安装依赖
npm install

# 如果服务器已有 node_modules，可以跳过此步骤
```

### 3. 配置环境变量

复制环境变量示例文件：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下变量：

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
NODE_ENV=production
```

### 4. 启动服务

#### 开发模式
```bash
npm run dev
```

#### 生产模式
```bash
npm start
```

#### 使用 PM2 管理进程
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name crm-wecom-api

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

### 5. 配置反向代理（可选）

#### Nginx 配置
```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 重要更新

### 企业微信登录修复

本次后端部署包含了以下重要修复：

- ✅ 使用 JWT 令牌替代 magiclink
- ✅ 修复用户邮箱逻辑，使用实际邮箱
- ✅ 优化用户元数据更新逻辑
- ✅ 改进错误处理和日志记录

### 修复内容

1. **JWT 令牌认证**：
   - 生成符合 Supabase 格式的 access_token 和 refresh_token
   - 使用正确的 JWT 载荷结构
   - 支持令牌过期时间管理

2. **用户邮箱修复**：
   - 用户已存在时使用实际邮箱（如：537093913@qq.com）
   - 不再使用临时邮箱（如：ZhouLingXin@wecom.local）

3. **依赖更新**：
   - 添加 jsonwebtoken 库支持
   - 优化 Supabase 客户端配置

## API 端点

- `GET /api/wecom/auth-url` - 获取企业微信授权 URL
- `POST /api/wecom/callback` - 处理企业微信回调
- `GET /api/wecom/status/:state` - 检查登录状态
- `GET /api/wecom/qr/:state` - 获取二维码

## 环境要求

- **Node.js**: >= 18.0.0
- **NPM**: >= 8.0.0
- **Supabase**: 需要配置正确的 JWT 密钥

## 故障排除

### 常见问题

1. **JWT 令牌验证失败**：
   - 检查 `VITE_SUPABASE_JWT_SECRET` 配置
   - 确认 Supabase 实例的 JWT 密钥

2. **企业微信登录失败**：
   - 检查企业微信配置参数
   - 验证回调 URL 设置

3. **用户邮箱错误**：
   - 确认用户已存在时使用实际邮箱
   - 检查用户元数据更新逻辑

### 日志检查

```bash
# 查看 PM2 日志
pm2 logs crm-wecom-api

# 查看实时日志
pm2 logs crm-wecom-api --lines 100

# 重启服务
pm2 restart crm-wecom-api
```

## 监控和维护

### 健康检查
```bash
curl http://localhost:3001/health
```

### 性能监控
```bash
# 查看 PM2 状态
pm2 status

# 查看资源使用情况
pm2 monit
```

## 联系支持

如有问题，请检查：
- 后端服务日志
- 环境变量配置
- Supabase 连接状态
- 企业微信 API 配置