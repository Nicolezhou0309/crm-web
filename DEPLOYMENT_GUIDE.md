# 企业微信认证系统部署指南

## 📦 构建包说明

本次构建生成了以下文件：

- **前端包**: `crm-web-frontend-20250908_093818.tar.gz` (1.7MB)
- **后端包**: `crm-wecom-api-20250908_093818.tar.gz` (7.9MB)

## 🚀 快速部署

### 1. 前端部署

```bash
# 解压前端文件
tar -xzf crm-web-frontend-20250908_093818.tar.gz

# 进入前端目录
cd frontend

# 设置环境变量
export API_BASE_URL=http://your-backend-domain:3001/api
export SUPABASE_URL=http://172.29.115.115:8000
export SUPABASE_ANON_KEY=your_anon_key_here

# 部署到 Web 服务器
sudo cp -r * /var/www/html/
```

### 2. 后端部署

```bash
# 解压后端文件
tar -xzf crm-wecom-api-20250908_093818.tar.gz

# 进入后端目录
cd backend

# 设置环境变量
export FRONTEND_URL=http://your-frontend-domain
export WECOM_CORP_ID=your_corp_id
export WECOM_AGENT_ID=your_agent_id
export WECOM_SECRET=your_secret
export WECOM_REDIRECT_URI=http://your-frontend-domain/auth/wecom/callback
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 运行部署脚本
./deploy.sh
```

## 🔧 环境变量配置

### 前端环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `API_BASE_URL` | 后端API地址 | `http://your-backend:3001/api` |
| `SUPABASE_URL` | Supabase实例地址 | `http://172.29.115.115:8000` |
| `SUPABASE_ANON_KEY` | Supabase匿名密钥 | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |

### 后端环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `FRONTEND_URL` | 前端地址 | `http://your-frontend-domain` |
| `WECOM_CORP_ID` | 企业微信企业ID | `ww68a125fce698cb59` |
| `WECOM_AGENT_ID` | 企业微信应用ID | `1000002` |
| `WECOM_SECRET` | 企业微信应用密钥 | `your_secret_here` |
| `WECOM_REDIRECT_URI` | 企业微信回调地址 | `http://your-frontend-domain/auth/wecom/callback` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase服务角色密钥 | `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...` |

## 🐳 Docker 部署

### 后端 Docker 部署

```bash
# 进入后端目录
cd backend

# 构建 Docker 镜像
docker build -t wecom-auth-api .

# 运行容器
docker run -d \
  --name wecom-auth-api \
  -p 3001:3001 \
  -e FRONTEND_URL=$FRONTEND_URL \
  -e WECOM_CORP_ID=$WECOM_CORP_ID \
  -e WECOM_AGENT_ID=$WECOM_AGENT_ID \
  -e WECOM_SECRET=$WECOM_SECRET \
  -e WECOM_REDIRECT_URI=$WECOM_REDIRECT_URI \
  -e SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  wecom-auth-api
```

### 使用 Docker Compose

```bash
# 创建 .env 文件
cat > .env << EOF
FRONTEND_URL=http://your-frontend-domain
WECOM_CORP_ID=your_corp_id
WECOM_AGENT_ID=your_agent_id
WECOM_SECRET=your_secret
WECOM_REDIRECT_URI=http://your-frontend-domain/auth/wecom/callback
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
EOF

# 启动服务
docker-compose up -d
```

## 🔧 Nginx 配置

### 完整 Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/html;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # 后端API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 企业微信回调
    location /auth/wecom/callback {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔍 验证部署

### 1. 检查后端服务

```bash
# 检查服务状态
curl http://localhost:3001/api/health

# 预期响应
{
  "success": true,
  "message": "企业微信认证API服务运行正常",
  "timestamp": "2025-01-08T09:38:18.000Z"
}
```

### 2. 检查前端服务

```bash
# 检查前端页面
curl http://your-frontend-domain

# 应该返回 HTML 页面
```

### 3. 测试企业微信认证

```bash
# 获取二维码
curl http://localhost:3001/api/auth/wecom/qrcode

# 预期响应
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?...",
    "state": "qrcode_...",
    "sessionId": "session_...",
    "expiresAt": 1234567890000,
    "expiresIn": 600000
  }
}
```

## 🛠️ 故障排除

### 常见问题

1. **后端启动失败**
   - 检查环境变量是否正确设置
   - 检查端口 3001 是否被占用
   - 查看日志：`pm2 logs wecom-auth-api`

2. **前端无法连接后端**
   - 检查 `API_BASE_URL` 配置
   - 检查 CORS 设置
   - 检查网络连接

3. **企业微信认证失败**
   - 检查企业微信配置是否正确
   - 检查回调地址是否可访问
   - 检查 Supabase 连接

### 日志查看

```bash
# 查看后端日志
pm2 logs wecom-auth-api

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 📞 技术支持

如有问题，请检查：

1. 环境变量配置
2. 网络连接
3. 服务状态
4. 日志信息

详细配置说明请参考各压缩包内的 `DEPLOYMENT_README.md` 文件。
