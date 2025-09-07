# 企业微信登录API部署指南

## 🎯 概述

这是企业微信登录API的后端服务，提供安全的OAuth2.0认证流程。

## 🚀 快速部署

### 方案一：直接部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repo>
cd crm-web/backend

# 2. 配置环境变量
cp env.example .env
# 编辑.env文件，填入实际配置

# 3. 安装依赖
npm install

# 4. 启动服务
npm start
```

### 方案二：使用部署脚本

```bash
# 1. 配置环境变量
cp env.example .env
# 编辑.env文件

# 2. 运行部署脚本
./deploy.sh
```

### 方案三：Docker部署

```bash
# 1. 配置环境变量
cp env.example .env
# 编辑.env文件

# 2. 构建并启动
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

## ⚙️ 环境变量配置

```bash
# 服务器配置
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com

# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_secret_here
WECOM_REDIRECT_URI=https://yourdomain.com/auth/wecom/callback
```

## 📋 API接口

### 1. 获取授权URL
```
GET /api/auth/wecom/url
```

### 2. 获取二维码
```
GET /api/auth/wecom/qrcode
```

### 3. 处理回调
```
POST /api/auth/wecom/callback
Content-Type: application/json

{
  "code": "auth_code",
  "state": "state_parameter"
}
```

### 4. 检查状态
```
GET /api/auth/wecom/status?state=state_parameter
```

### 5. 健康检查
```
GET /api/health
```

## 🔧 管理命令

### PM2管理
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs crm-wecom-api

# 重启服务
pm2 restart crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api
```

### Docker管理
```bash
# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down
```

## 🔒 安全配置

### 1. SSL证书
```bash
# 使用Let's Encrypt
certbot --nginx -d api.yourdomain.com
```

### 2. 防火墙
```bash
# 只开放必要端口
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### 3. 环境变量安全
- 使用环境变量管理敏感信息
- 生产环境使用密钥管理服务
- 定期轮换密钥

## 📊 监控和日志

### 1. 日志位置
- PM2日志：`/var/log/pm2/`
- Nginx日志：`/var/log/nginx/`
- Docker日志：`docker-compose logs`

### 2. 监控指标
- API响应时间
- 错误率
- 请求量
- 系统资源使用

## 🧪 测试

### 1. 健康检查
```bash
curl https://api.yourdomain.com/api/health
```

### 2. 功能测试
```bash
# 获取授权URL
curl https://api.yourdomain.com/api/auth/wecom/url

# 获取二维码
curl https://api.yourdomain.com/api/auth/wecom/qrcode
```

## 🚨 故障排除

### 1. 服务无法启动
- 检查端口是否被占用
- 检查环境变量配置
- 查看错误日志

### 2. 企业微信认证失败
- 检查企业微信配置
- 验证回调地址
- 检查网络连接

### 3. 性能问题
- 检查系统资源
- 优化Nginx配置
- 考虑使用Redis缓存

## 📞 支持

如有问题，请：
1. 查看日志文件
2. 检查配置是否正确
3. 联系开发团队

## 📚 相关文档

- [企业微信OAuth文档](https://developer.work.weixin.qq.com/document/path/91120)
- [JustAuth官方文档](https://justauth.cn/)
- [Nginx配置指南](https://nginx.org/en/docs/)
