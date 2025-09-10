# 企业微信API完整部署指南

## 📦 压缩包信息
- **文件名**: `crm-wecom-api-complete-20250907-173726.tar.gz`
- **大小**: 60K
- **包含**: 后端代码 + Nginx配置 + 部署脚本

## 🚀 快速部署步骤

### 1. 上传压缩包到服务器
```bash
# 使用scp上传
scp crm-wecom-api-complete-20250907-173726.tar.gz root@your-server:/tmp/

# 或使用其他方式上传到服务器
```

### 2. 解压并进入目录
```bash
cd /tmp
tar -xzf crm-wecom-api-complete-20250907-173726.tar.gz
cd crm-wecom-api-complete-20250907-173726
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp env.example .env

# 编辑环境变量文件
vi .env
```

**需要配置的环境变量**:
```bash
# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_secret_here
WECOM_REDIRECT_URI=https://lead.vld.com.cn/auth/wecom/callback

# 服务器配置
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://lead.vld.com.cn
```

### 4. 运行完整部署脚本
```bash
sudo ./deploy-complete.sh
```

## ✅ 部署验证

部署完成后，验证以下内容：

### 1. 检查服务状态
```bash
pm2 status crm-wecom-api
```

### 2. 测试健康检查
```bash
curl https://lead.vld.com.cn/api/health
```

### 3. 测试企业微信API
```bash
curl https://lead.vld.com.cn/api/auth/wecom/qrcode
```

### 4. 测试长轮询API
```bash
curl "https://lead.vld.com.cn/api/auth/wecom/poll?state=test"
```

## 🔧 包含的脚本说明

| 脚本名称 | 功能描述 |
|---------|---------|
| `deploy-complete.sh` | 完整部署脚本（推荐） |
| `update-backend.sh` | 仅更新后端服务 |
| `quick-deploy.sh` | 快速部署脚本 |
| `check-nginx-config.sh` | 检查Nginx配置 |
| `fix-nginx-config.sh` | 修复Nginx配置 |
| `test-local.sh` | 本地测试脚本 |

## 🌐 Nginx配置说明

部署脚本会自动配置以下Nginx路由：

```nginx
# 企业微信API路由
location /api/auth/wecom/ {
    proxy_pass http://wecom_api/api/auth/wecom/;
    # 支持长轮询
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection "";
    proxy_http_version 1.1;
    # CORS支持
    add_header Access-Control-Allow-Origin *;
}
```

## 🐛 故障排除

### 问题1: 服务启动失败
```bash
# 查看日志
pm2 logs crm-wecom-api

# 检查端口占用
netstat -tlnp | grep 3001
```

### 问题2: Nginx配置错误
```bash
# 检查配置语法
nginx -t

# 查看Nginx错误日志
tail -f /var/log/nginx/error.log
```

### 问题3: API返回404
```bash
# 检查Nginx配置
sudo ./check-nginx-config.sh

# 修复Nginx配置
sudo ./fix-nginx-config.sh
```

### 问题4: 长轮询不工作
```bash
# 检查长轮询API
curl "https://lead.vld.com.cn/api/auth/wecom/poll?state=test"

# 如果API正常，检查服务状态
```

## 📝 常用命令

```bash
# 查看服务状态
pm2 status crm-wecom-api

# 重启服务
pm2 restart crm-wecom-api

# 查看日志
pm2 logs crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api

# 重载Nginx配置
systemctl reload nginx

# 检查Nginx状态
systemctl status nginx
```

## 🔄 回滚操作

如果部署出现问题，可以回滚：

```bash
# 停止服务
pm2 stop crm-wecom-api

# 恢复备份（部署脚本会自动创建备份）
cp /opt/backups/crm-wecom-api/backup-*/* /opt/crm-wecom-api/

# 重启服务
pm2 restart crm-wecom-api
```

## 📞 技术支持

如果遇到问题，请提供以下信息：
1. 服务器操作系统版本
2. Node.js版本
3. PM2版本
4. 错误日志内容
5. 部署脚本输出

---

**部署完成后，您的企业微信扫码登录功能应该可以正常工作了！** 🎉