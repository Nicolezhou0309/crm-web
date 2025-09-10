# 企业微信登录API完整文档

## 📋 概述

本文档提供了企业微信登录API的完整技术文档，包括API接口、服务器配置、部署指南等。

## 🏗️ 系统架构

### 架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   API服务器     │    │   企业微信      │
│  (React/Vue)    │    │  (Node.js)      │    │   (OAuth2.0)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ 1. 获取授权URL       │                      │
          ├─────────────────────►│                      │
          │                      │ 2. 生成授权URL       │
          │                      ├─────────────────────►│
          │                      │                      │
          │ 3. 用户授权          │                      │
          ├─────────────────────►│                      │
          │                      │ 4. 处理回调          │
          │                      ├─────────────────────►│
          │                      │                      │
          │ 5. 返回用户信息      │                      │
          │◄─────────────────────┤                      │
```

### 技术栈
- **后端**: Node.js + Express
- **进程管理**: PM2
- **反向代理**: Nginx
- **认证**: 企业微信OAuth2.0
- **部署**: 阿里云服务器

## 🖥️ 服务器配置

### 系统环境
```bash
操作系统: Alibaba Cloud Linux 3.2104 (OpenAnolis Edition)
内核版本: Linux 5.10.134-19.1.al8.x86_64
Node.js版本: v18.20.8
Nginx版本: 1.20.1
PM2版本: 最新版
部署状态: ✅ 已部署并运行正常
```

### 服务器规格
```bash
CPU: 2核心
内存: 4GB
存储: 40GB SSD
网络: 公网IP + 内网IP
域名: lead-service.vld.com.cn
API路径: /api/
```

### 端口配置
```bash
80   - HTTP (重定向到HTTPS)
443  - HTTPS (API服务)
3001 - 内部API服务 (仅本地访问)
22   - SSH管理端口
```

## 🔧 环境变量配置

### 服务器环境变量 (.env)
```bash
# 服务器配置
PORT=3001
NODE_ENV=production

# 前端地址（用于CORS配置）
FRONTEND_URL=https://lead.vld.com.cn

# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=sXQeFCLDQJkwrX5lMWDzBTEIiHK1J7-a2e7chPyqYxY
WECOM_REDIRECT_URI=https://lead.vld.com.cn/auth/wecom/callback
```

### 前端环境变量
```bash
# 企业微信公开配置
VITE_WECOM_CORP_ID=ww68a125fce698cb59
VITE_WECOM_AGENT_ID=1000002
VITE_WECOM_REDIRECT_URI=https://lead.vld.com.cn/auth/wecom/callback

# API服务地址 (已更新为路径方式)
VITE_API_BASE_URL=https://lead.vld.com.cn/api
```

## 📡 API接口文档

### 基础信息
- **Base URL**: `https://lead.vld.com.cn/api`
- **协议**: HTTPS
- **数据格式**: JSON
- **字符编码**: UTF-8
- **部署状态**: ✅ 已部署并运行正常
- **部署时间**: 2025-09-07 13:00
- **最后更新**: 2025-09-07 14:41

### 部署变更记录
- **2025-09-07**: 从子域名方式 (`api.lead-service.vld.com.cn`) 改为路径方式 (`lead-service.vld.com.cn/api`)
- **原因**: 避免DNS解析问题，使用现有域名配置
- **影响**: 所有API端点URL已更新，前端配置已同步更新

### 1. 健康检查

#### 接口信息
```http
GET /api/health
```

#### 请求示例
```bash
curl https://lead.vld.com.cn/api/health
```

#### 响应示例
```json
{
  "success": true,
  "message": "企业微信认证API服务运行正常",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 获取授权URL

#### 接口信息
```http
GET /api/auth/wecom/url
```

#### 请求示例
```bash
curl https://lead.vld.com.cn/api/auth/wecom/url
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=ww68a125fce698cb59&redirect_uri=https%3A%2F%2Flead-service.vld.com.cn%2Fauth%2Fwecom%2Fcallback&response_type=code&scope=snsapi_base&state=wecom_auth_1234567890&agentid=1000002#wechat_redirect",
    "state": "wecom_auth_1234567890"
  }
}
```

### 3. 获取二维码

#### 接口信息
```http
GET /api/auth/wecom/qrcode
```

#### 请求示例
```bash
curl https://lead.vld.com.cn/api/auth/wecom/qrcode
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=ww68a125fce698cb59&redirect_uri=https%3A%2F%2Flead-service.vld.com.cn%2Fauth%2Fwecom%2Fcallback&response_type=code&scope=snsapi_base&state=qrcode_1234567890_abc123&agentid=1000002#wechat_redirect",
    "state": "qrcode_1234567890_abc123"
  }
}
```

### 4. 处理回调

#### 接口信息
```http
POST /api/auth/wecom/callback
Content-Type: application/json
```

#### 请求参数
```json
{
  "code": "auth_code_from_wecom",
  "state": "state_parameter"
}
```

#### 请求示例
```bash
curl -X POST https://lead.vld.com.cn/api/auth/wecom/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "auth_code_from_wecom",
    "state": "state_parameter"
  }'
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "userInfo": {
      "UserId": "zhangsan",
      "name": "张三",
      "mobile": "13800138000",
      "email": "zhangsan@company.com",
      "department": "技术部",
      "position": "工程师",
      "corpId": "ww68a125fce698cb59",
      "avatar": "https://..."
    },
    "redirectUrl": "/dashboard"
  }
}
```

### 5. 检查登录状态

#### 接口信息
```http
GET /api/auth/wecom/status?state=state_parameter
```

#### 请求示例
```bash
curl "https://lead.vld.com.cn/api/auth/wecom/status?state=qrcode_1234567890_abc123"
```

#### 响应示例
```json
{
  "success": true,
  "data": {
    "status": "success",
    "userInfo": {
      "UserId": "zhangsan",
      "name": "张三",
      "mobile": "13800138000",
      "email": "zhangsan@company.com",
      "department": "技术部",
      "position": "工程师",
      "corpId": "ww68a125fce698cb59",
      "avatar": "https://..."
    }
  }
}
```

## 🔒 安全配置

### SSL/TLS配置
```nginx
# SSL协议版本
ssl_protocols TLSv1.2 TLSv1.3;

# SSL加密套件
ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;

# 安全头设置
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 速率限制
```javascript
// 15分钟内最多100个请求
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: '请求过于频繁，请稍后再试'
});
```

### CORS配置
```javascript
app.use(cors({
  origin: 'https://lead.vld.com.cn',
  credentials: true
}));
```

## 🌐 Nginx配置

### 主配置文件
```nginx
# /etc/nginx/conf.d/crm-wecom-api.conf

upstream wecom_api {
    server 127.0.0.1:3001;
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name lead-service.vld.com.cn;
    return 301 https://$server_name$request_uri;
}

# HTTPS服务器
server {
    listen 443 ssl http2;
    server_name lead-service.vld.com.cn;
    
    # SSL配置
    ssl_certificate /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # API代理
    location /api/auth/wecom/ {
        proxy_pass http://wecom_api/api/auth/wecom/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 健康检查
    location /api/health {
        proxy_pass http://wecom_api/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔧 PM2配置

### 进程管理配置
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'crm-wecom-api',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/pm2/crm-wecom-api-error.log',
    out_file: '/var/log/pm2/crm-wecom-api-out.log',
    log_file: '/var/log/pm2/crm-wecom-api.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### PM2管理命令
```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs crm-wecom-api

# 重启服务
pm2 restart crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api

# 删除服务
pm2 delete crm-wecom-api

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

## 📊 监控和日志

### 日志位置
```bash
# PM2日志
/var/log/pm2/crm-wecom-api.log
/var/log/pm2/crm-wecom-api-error.log
/var/log/pm2/crm-wecom-api-out.log

# Nginx日志
/var/log/nginx/access.log
/var/log/nginx/error.log

# 系统日志
/var/log/messages
```

### 监控指标
```bash
# 服务状态
pm2 status

# 系统资源
htop
df -h
free -h

# 网络连接
netstat -tlnp | grep -E ":80|:443|:3001"

# 进程信息
ps aux | grep -E "(nginx|node|pm2)"
```

## 🚀 部署流程

### 1. 环境准备
```bash
# 检查系统环境
uname -a
cat /etc/os-release
node --version
nginx -v
```

### 2. 上传代码
```bash
# 上传部署包
scp crm-wecom-api-existing-env.tar.gz root@8.159.132.181:/opt/

# 解压部署包
cd /opt
tar -xzf crm-wecom-api-existing-env.tar.gz
cd crm-wecom-api
```

### 3. 执行部署
```bash
# 运行部署脚本
./aliyun-existing-env-deploy.sh
```

### 4. 验证部署
```bash
# 检查服务状态
pm2 status
systemctl status nginx

# 测试API接口
curl https://lead.vld.com.cn/api/health
```

## 🔍 故障排除

### 常见问题

#### 1. 服务无法启动
```bash
# 检查端口占用
netstat -tlnp | grep 3001

# 检查日志
pm2 logs crm-wecom-api

# 检查环境变量
cat .env
```

#### 2. Nginx配置错误
```bash
# 测试配置
nginx -t

# 查看错误日志
tail -f /var/log/nginx/error.log

# 重载配置
systemctl reload nginx
```

#### 3. SSL证书问题
```bash
# 检查证书状态
openssl s_client -connect lead-service.vld.com.cn:443

# 检查证书文件
ls -la /etc/ssl/certs/
ls -la /etc/ssl/private/
```

#### 4. 企业微信认证失败
```bash
# 检查配置
echo $WECOM_CORP_ID
echo $WECOM_AGENT_ID
echo $WECOM_SECRET

# 检查网络连接
curl -I https://qyapi.weixin.qq.com
```

## 📚 相关文档

- [企业微信OAuth文档](https://developer.work.weixin.qq.com/document/path/91120)
- [JustAuth官方文档](https://justauth.cn/)
- [PM2官方文档](https://pm2.keymetrics.io/docs/)
- [Nginx官方文档](http://nginx.org/en/docs/)
- [阿里云ECS文档](https://help.aliyun.com/product/25365.html)

## 📞 技术支持

### 联系方式
- **技术支持**: 开发团队
- **文档更新**: 2024-01-01
- **版本**: v1.0.0

### 更新日志
- **v1.0.0** (2024-01-01): 初始版本，支持企业微信OAuth2.0登录
