# 后端服务器部署命令指南

## 🚀 快速部署（推荐）

### 1. 上传文件到服务器
```bash
# 上传最新的修复版本部署包
scp crm-wecom-api-fixed-20250907-212110.tar.gz root@your-server-ip:/opt/

# 上传快速部署脚本
scp backend/quick-deploy.sh root@your-server-ip:/opt/

# 上传Nginx配置
scp backend/nginx-config.conf root@your-server-ip:/opt/
```

### 2. 服务器上执行一键部署
```bash
# 登录服务器
ssh root@your-server-ip

# 进入目录
cd /opt/

# 给脚本执行权限
chmod +x quick-deploy.sh

# 运行快速部署脚本
./quick-deploy.sh
```

## 🔧 手动部署命令（分步执行）

### 步骤1: 环境准备
```bash
# 更新系统
apt update && apt upgrade -y

# 安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# 验证安装
node --version
npm --version

# 安装PM2进程管理器
npm install -g pm2

# 安装Nginx
apt install nginx -y
```

### 步骤2: 部署应用
```bash
# 创建应用目录
mkdir -p /opt/crm-wecom-api
cd /opt/crm-wecom-api

# 解压最新修复版本
tar -xzf /opt/crm-wecom-api-fixed-20250907-212110.tar.gz

# 安装生产依赖
npm install --production

# 验证安装
npm list --depth=0
```

### 步骤3: 配置环境变量
```bash
# 创建生产环境配置文件
nano .env
```

**环境变量配置内容：**
```bash
# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=your_actual_secret_here
WECOM_REDIRECT_URI=https://lead.vld.com.cn/api/auth/wecom/callback

# 服务器配置
PORT=3001
FRONTEND_URL=https://lead.vld.com.cn
NODE_ENV=production

# 日志配置
LOG_LEVEL=info
```

### 步骤4: 启动服务
```bash
# 停止可能存在的旧服务
pm2 delete crm-wecom-api 2>/dev/null || true

# 启动新服务
pm2 start server.js --name crm-wecom-api

# 设置开机自启
pm2 startup
pm2 save

# 查看服务状态
pm2 status
pm2 logs crm-wecom-api --lines 20
```

### 步骤5: 配置Nginx反向代理
```bash
# 复制Nginx配置
cp /opt/nginx-config.conf /etc/nginx/sites-available/crm-wecom-api

# 启用站点
ln -s /etc/nginx/sites-available/crm-wecom-api /etc/nginx/sites-enabled/

# 删除默认站点
rm -f /etc/nginx/sites-enabled/default

# 测试配置
nginx -t

# 重启Nginx
systemctl restart nginx
systemctl enable nginx
```

### 步骤6: 配置SSL证书
```bash
# 安装Certbot
apt install certbot python3-certbot-nginx -y

# 获取SSL证书
certbot --nginx -d lead-service.vld.com.cn

# 设置自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### 步骤7: 配置防火墙
```bash
# 开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS

# 启用防火墙
ufw --force enable

# 查看状态
ufw status
```

## 🧪 测试验证命令

### 1. 基础服务测试
```bash
# 测试API健康检查
curl -s http://localhost:3001/api/health | jq .

# 测试Nginx代理
curl -s https://lead.vld.com.cn/api/health | jq .

# 测试二维码生成API
curl -s https://lead.vld.com.cn/api/auth/wecom/qrcode | jq .
```

### 2. 企业微信回调测试
```bash
# 测试回调处理（模拟）
curl -X POST https://lead.vld.com.cn/api/auth/wecom/callback \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","state":"test_state","sessionId":"test_session"}'
```

### 3. 运行自动化测试
```bash
# 进入应用目录
cd /opt/crm-wecom-api

# 运行会话跟踪测试
chmod +x test-session-tracking.sh
./test-session-tracking.sh

# 运行回调流程测试
chmod +x test-new-callback-flow.sh
./test-new-callback-flow.sh
```

## 📊 监控和维护命令

### 1. 服务监控
```bash
# 查看PM2状态
pm2 status

# 查看实时日志
pm2 logs crm-wecom-api --lines 100

# 查看错误日志
pm2 logs crm-wecom-api --err --lines 50

# 监控资源使用
pm2 monit

# 重启服务
pm2 restart crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api
```

### 2. 系统监控
```bash
# 查看端口占用
netstat -tlnp | grep 3001
ss -tlnp | grep 3001

# 查看Nginx状态
systemctl status nginx

# 查看Nginx日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 查看系统资源
htop
df -h
free -h
```

### 3. 应用日志监控
```bash
# 查看应用日志
tail -f /opt/crm-wecom-api/logs/app.log

# 查看错误日志
tail -f /opt/crm-wecom-api/logs/error.log

# 实时监控所有日志
pm2 logs crm-wecom-api --raw
```

## 🔄 更新部署命令

### 1. 备份当前版本
```bash
# 停止服务
pm2 stop crm-wecom-api

# 备份当前版本
cp -r /opt/crm-wecom-api /opt/crm-wecom-api-backup-$(date +%Y%m%d-%H%M%S)

# 备份数据库（如果有）
# mysqldump -u username -p database_name > backup_$(date +%Y%m%d).sql
```

### 2. 部署新版本
```bash
# 进入应用目录
cd /opt/crm-wecom-api

# 解压新版本
tar -xzf /opt/crm-wecom-api-fixed-20250907-212110.tar.gz

# 安装新依赖
npm install --production

# 重启服务
pm2 restart crm-wecom-api

# 验证更新
pm2 status
curl -s http://localhost:3001/api/health
```

## 🚨 故障排除命令

### 1. 服务问题诊断
```bash
# 查看详细错误信息
pm2 logs crm-wecom-api --err --lines 100

# 检查环境变量
cat /opt/crm-wecom-api/.env

# 检查端口监听
lsof -i :3001

# 检查进程状态
ps aux | grep node
```

### 2. Nginx问题诊断
```bash
# 测试Nginx配置
nginx -t

# 查看Nginx错误日志
tail -f /var/log/nginx/error.log

# 检查Nginx进程
systemctl status nginx
ps aux | grep nginx

# 重新加载配置
nginx -s reload
```

### 3. 网络问题诊断
```bash
# 检查DNS解析
nslookup lead-service.vld.com.cn

# 检查SSL证书
openssl s_client -connect lead-service.vld.com.cn:443 -servername lead-service.vld.com.cn

# 检查防火墙规则
ufw status verbose

# 测试网络连接
curl -I https://qyapi.weixin.qq.com
```

## 📋 部署检查清单

### 部署前检查
- [ ] 服务器系统已更新
- [ ] Node.js 18.x 已安装
- [ ] PM2 已安装
- [ ] Nginx 已安装
- [ ] 防火墙已配置
- [ ] 域名DNS已解析

### 部署过程检查
- [ ] 部署包已上传
- [ ] 应用已解压
- [ ] 依赖已安装
- [ ] 环境变量已配置
- [ ] 服务已启动
- [ ] Nginx已配置
- [ ] SSL证书已安装

### 部署后验证
- [ ] API健康检查通过
- [ ] 二维码生成正常
- [ ] 企业微信回调正常
- [ ] 前端页面可访问
- [ ] 日志记录正常
- [ ] 监控告警正常

## 🎯 最终验证地址

部署完成后，以下地址应该可以正常访问：

- ✅ **健康检查**: https://lead.vld.com.cn/api/health
- ✅ **二维码API**: https://lead.vld.com.cn/api/auth/wecom/qrcode
- ✅ **前端页面**: https://lead.vld.com.cn
- ✅ **企业微信回调**: https://lead.vld.com.cn/api/auth/wecom/callback

## 🔧 最新修复内容

本次部署包含以下修复：

- ✅ **修复企业微信回调处理**：兼容 `OpenId` 和 `openid` 字段
- ✅ **改进错误处理**：提供更详细的错误信息
- ✅ **优化日志记录**：更好的调试信息
- ✅ **增强稳定性**：更好的异常处理

---

**部署完成后，您的企业微信登录服务将完全可用！** 🎉
