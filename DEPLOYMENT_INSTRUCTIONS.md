# 企业微信API后端服务 - 完整部署包使用说明

## 📦 压缩包信息

- **文件名**: `crm-wecom-api-complete-20250907-205707.tar.gz`
- **大小**: 99KB
- **包含**: 完整的后端服务代码 + 所有部署脚本 + 配置文件

## 🆕 新功能特性

### 会话跟踪机制
- ✅ 支持多用户并发扫码登录
- ✅ 每个前端会话都有唯一的sessionId
- ✅ 后端可以准确识别是哪个前端在登录
- ✅ 防止会话冲突和状态混乱
- ✅ 自动清理过期的会话和状态

### 企业微信OAuth2流程
- ✅ 支持企业微信扫码登录
- ✅ 完整的OAuth2授权流程
- ✅ 前端回调页面处理
- ✅ 后端API处理用户信息获取
- ✅ 长轮询实时状态监听

## 🚀 部署方式

### 方式1: 完整部署（推荐）

```bash
# 1. 上传压缩包到服务器
scp crm-wecom-api-complete-20250907-205707.tar.gz root@your-server-ip:/opt/

# 2. 登录服务器
ssh root@your-server-ip

# 3. 解压压缩包
cd /opt/
tar -xzf crm-wecom-api-complete-20250907-205707.tar.gz
cd crm-wecom-api-complete/

# 4. 运行完整部署脚本
chmod +x build-and-deploy.sh
./build-and-deploy.sh
```

**完整部署脚本功能：**
- 自动安装Node.js、PM2、Nginx
- 创建应用目录和安装依赖
- 配置环境变量
- 启动PM2服务
- 配置Nginx反向代理
- 配置防火墙规则
- 测试API接口

### 方式2: 快速部署

```bash
# 1. 上传压缩包到服务器
scp crm-wecom-api-complete-20250907-205707.tar.gz root@your-server-ip:/opt/

# 2. 登录服务器
ssh root@your-server-ip

# 3. 解压压缩包
cd /opt/
tar -xzf crm-wecom-api-complete-20250907-205707.tar.gz
cd crm-wecom-api-complete/

# 4. 运行快速部署脚本
chmod +x quick-deploy.sh
./quick-deploy.sh
```

**快速部署脚本功能：**
- 检查并安装Node.js和PM2
- 安装项目依赖
- 配置环境变量
- 启动PM2服务
- 设置开机自启

## ⚙️ 环境变量配置

部署脚本会自动创建 `.env` 文件，请编辑配置：

```bash
# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_actual_secret_here
WECOM_REDIRECT_URI=https://lead.vld.com.cn/api/auth/wecom/callback

# 服务配置
PORT=3001
FRONTEND_URL=https://lead.vld.com.cn
NODE_ENV=production
```

## 🔧 企业微信应用配置

### 管理后台配置
1. **应用ID**: `1000002`
2. **授权回调域**: `lead-service.vld.com.cn`
3. **应用权限**: 确保有"网页授权"权限
4. **可见范围**: 包含测试用户

### 回调URL
- **完整回调URL**: `https://lead.vld.com.cn/api/auth/wecom/callback`
- **授权回调域**: `lead-service.vld.com.cn`

## 🧪 测试功能

部署完成后，可以使用以下脚本测试：

```bash
# 会话跟踪测试
chmod +x test-session-tracking.sh
./test-session-tracking.sh

# 回调流程测试
chmod +x test-new-callback-flow.sh
./test-new-callback-flow.sh

# 扫码登录诊断
chmod +x diagnose-scan-login.sh
./diagnose-scan-login.sh

# 回调日志检查
chmod +x check-callback-logs.sh
./check-callback-logs.sh
```

## 📋 API接口

### 1. 获取二维码
```
GET /api/auth/wecom/qrcode
```

### 2. 处理回调（GET - 企业微信重定向）
```
GET /api/auth/wecom/callback?code=XXX&state=XXX
```

### 3. 处理回调（POST - 前端发送）
```
POST /api/auth/wecom/callback
Content-Type: application/json

{
  "code": "XXX",
  "state": "XXX",
  "sessionId": "XXX"
}
```

### 4. 长轮询状态
```
GET /api/auth/wecom/poll?state=XXX&sessionId=XXX
```

### 5. 检查状态
```
GET /api/auth/wecom/status?state=XXX&sessionId=XXX
```

### 6. 健康检查
```
GET /api/health
```

## 🔍 监控和管理

### 服务管理
```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs crm-wecom-api

# 重启服务
pm2 restart crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api

# 监控资源使用
pm2 monit
```

### 日志管理
```bash
# 查看所有日志
pm2 logs

# 清空日志
pm2 flush

# 查看错误日志
pm2 logs crm-wecom-api --err
```

## 🔄 更新部署

### 1. 停止服务
```bash
pm2 stop crm-wecom-api
```

### 2. 备份当前版本
```bash
cp -r /opt/crm-wecom-api /opt/crm-wecom-api-backup-$(date +%Y%m%d)
```

### 3. 部署新版本
```bash
cd /opt/crm-wecom-api
# 替换文件后
npm install --production
```

### 4. 启动服务
```bash
pm2 start crm-wecom-api
```

## 🚨 故障排除

### 常见问题

1. **扫码后无API调用日志**
   - 检查企业微信应用配置
   - 确认应用密钥是否正确
   - 验证应用是否已启用

2. **会话ID不匹配**
   - 检查前端是否正确保存sessionId
   - 确认localStorage中的sessionId

3. **长轮询超时**
   - 检查网络连接
   - 确认后端服务正常运行

### 调试命令

```bash
# 检查服务状态
pm2 status

# 查看详细错误
pm2 logs crm-wecom-api --err

# 检查端口占用
netstat -tlnp | grep 3001

# 测试API接口
curl http://localhost:3001/api/health
```

## 📞 技术支持

如有问题，请检查：
1. 企业微信管理后台配置
2. 后端服务日志
3. 网络连接状态
4. 环境变量配置

---

**构建时间**: 2025-09-07 20:57:00  
**版本**: 包含会话跟踪机制的企业微信登录  
**功能**: 多用户并发扫码登录支持  
**部署方式**: 支持完整部署和快速部署两种方式
