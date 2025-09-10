# 阿里云服务器企业微信登录API部署指南

## 🎯 概述

本指南将帮助您在阿里云服务器上部署企业微信登录API服务。

## 🚀 快速部署

### 1. 准备工作

#### 1.1 服务器要求
- **操作系统**: Ubuntu 20.04 LTS 或 CentOS 7+
- **内存**: 最少1GB，推荐2GB+
- **存储**: 最少20GB可用空间
- **网络**: 公网IP，开放80和443端口

#### 1.2 域名配置
- **API域名**: `api.lead-service.vld.com.cn`
- **前端域名**: `lead-service.vld.com.cn`
- 确保域名已解析到服务器IP

### 2. 上传代码到服务器

#### 方法一：使用SCP上传（推荐）
```bash
# 在本地执行
scp crm-wecom-api-existing-env.tar.gz root@8.159.132.181:/tmp/
```

#### 方法二：使用其他工具上传
```bash
# 使用rsync
rsync -avz crm-wecom-api-existing-env.tar.gz root@8.159.132.181:/tmp/

# 使用SFTP
sftp root@8.159.132.181
put crm-wecom-api-existing-env.tar.gz /tmp/
```

### 3. 解压部署包

```bash
# 登录服务器
ssh root@8.159.132.181

# 进入临时目录
cd /tmp

# 解压部署包
tar -xzf crm-wecom-api-existing-env-*.tar.gz
```

### 4. 执行部署脚本

```bash
# 进入解压后的目录
cd backend

# 执行部署脚本
sudo ./aliyun-existing-env-deploy.sh
```

**注意**: 部署脚本会自动：
1. 检测当前目录是否已解压（包含package.json和server.js）
2. 如果未解压，会从 `/tmp` 目录查找并解压部署文件
3. 安装依赖和配置服务

## ⚙️ 环境变量配置

部署脚本会自动配置以下环境变量：

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

## 🔒 SSL证书配置

### 方案一：使用Let's Encrypt（推荐）

```bash
# 安装certbot
apt install -y certbot python3-certbot-nginx

# 申请SSL证书
certbot --nginx -d api.lead-service.vld.com.cn

# 设置自动续期
crontab -e
# 添加以下行
0 12 * * * /usr/bin/certbot renew --quiet
```

### 方案二：使用阿里云SSL证书

1. **申请证书**
   - 登录阿里云控制台
   - 进入SSL证书服务
   - 申请免费DV证书

2. **下载证书**
   - 下载Nginx格式证书
   - 解压得到 `.pem` 和 `.key` 文件

3. **上传证书**
   ```bash
   # 创建证书目录
   mkdir -p /etc/ssl/certs/aliyun
   mkdir -p /etc/ssl/private/aliyun
   
   # 上传证书文件
   scp your-domain.pem root@server:/etc/ssl/certs/aliyun/
   scp your-domain.key root@server:/etc/ssl/private/aliyun/
   ```

4. **更新Nginx配置**
   ```bash
   # 编辑Nginx配置
   nano /etc/nginx/sites-available/crm-wecom-api
   
   # 更新SSL证书路径
   ssl_certificate /etc/ssl/certs/aliyun/your-domain.pem;
   ssl_certificate_key /etc/ssl/private/aliyun/your-domain.key;
   
   # 重载Nginx
   nginx -t && systemctl reload nginx
   ```

## 🌐 阿里云安全组配置

### 1. 配置安全组规则

在阿里云控制台配置安全组：

| 方向 | 协议 | 端口范围 | 授权对象 | 描述 |
|------|------|----------|----------|------|
| 入方向 | TCP | 22 | 0.0.0.0/0 | SSH访问 |
| 入方向 | TCP | 80 | 0.0.0.0/0 | HTTP访问 |
| 入方向 | TCP | 443 | 0.0.0.0/0 | HTTPS访问 |
| 出方向 | ALL | ALL | 0.0.0.0/0 | 全部出方向 |

### 2. 配置防火墙

```bash
# 配置UFW防火墙
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

## 📊 监控和日志

### 1. 服务监控

```bash
# 查看PM2状态
pm2 status

# 查看实时日志
pm2 logs crm-wecom-api

# 查看系统资源使用
pm2 monit
```

### 2. 日志管理

```bash
# 日志位置
/var/log/pm2/crm-wecom-api.log
/var/log/nginx/access.log
/var/log/nginx/error.log

# 日志轮转配置
nano /etc/logrotate.d/crm-wecom-api
```

### 3. 系统监控

```bash
# 安装htop监控系统资源
apt install -y htop

# 查看系统状态
htop
df -h
free -h
```

## 🧪 测试验证

### 1. 健康检查

```bash
# 测试API健康状态
curl https://api.lead-service.vld.com.cn/api/health

# 预期响应
{
  "success": true,
  "message": "企业微信认证API服务运行正常",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. 功能测试

```bash
# 测试获取授权URL
curl https://api.lead-service.vld.com.cn/api/auth/wecom/url

# 测试获取二维码
curl https://api.lead-service.vld.com.cn/api/auth/wecom/qrcode
```

### 3. 前端集成测试

更新前端API地址：

```typescript
// 在 src/api/wecomAuthApi.ts 中更新API地址
const API_BASE_URL = 'https://api.lead-service.vld.com.cn';
```

## 🔧 维护管理

### 1. 服务管理

```bash
# 启动服务
pm2 start crm-wecom-api

# 停止服务
pm2 stop crm-wecom-api

# 重启服务
pm2 restart crm-wecom-api

# 删除服务
pm2 delete crm-wecom-api
```

### 2. 更新部署

```bash
# 1. 备份当前版本
cp -r /opt/crm-wecom-api /opt/crm-wecom-api-backup-$(date +%Y%m%d)

# 2. 更新代码
cd /opt/crm-wecom-api/backend
git pull origin main

# 3. 安装新依赖
npm install --production

# 4. 重启服务
pm2 restart crm-wecom-api
```

### 3. 备份策略

```bash
# 创建备份脚本
cat > /opt/backup-api.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/crm-wecom-api-$DATE.tar.gz /opt/crm-wecom-api
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /opt/backup-api.sh

# 设置定时备份
crontab -e
# 添加以下行（每天凌晨2点备份）
0 2 * * * /opt/backup-api.sh
```

## 🚨 故障排除

### 1. 服务无法启动

```bash
# 检查端口占用
netstat -tlnp | grep 3001

# 检查日志
pm2 logs crm-wecom-api

# 检查环境变量
cat /opt/crm-wecom-api/backend/.env
```

### 2. SSL证书问题

```bash
# 检查证书状态
certbot certificates

# 测试SSL配置
openssl s_client -connect api.lead-service.vld.com.cn:443
```

### 3. 网络连接问题

```bash
# 检查DNS解析
nslookup api.lead-service.vld.com.cn

# 检查防火墙状态
ufw status

# 检查Nginx状态
systemctl status nginx
```

## 📞 技术支持

### 1. 日志收集

```bash
# 收集系统信息
uname -a
cat /etc/os-release
node --version
npm --version
pm2 --version
nginx -v

# 收集服务日志
pm2 logs crm-wecom-api --lines 100
tail -n 100 /var/log/nginx/error.log
```

### 2. 性能优化

```bash
# 优化PM2配置
pm2 install pm2-logrotate

# 优化Nginx配置
# 在nginx.conf中添加gzip压缩和缓存配置
```

## 📚 相关文档

- [阿里云ECS使用指南](https://help.aliyun.com/product/25365.html)
- [阿里云SSL证书服务](https://www.aliyun.com/product/cas)
- [PM2官方文档](https://pm2.keymetrics.io/docs/)
- [Nginx官方文档](http://nginx.org/en/docs/)
- [Let's Encrypt文档](https://letsencrypt.org/docs/)

## 🎉 部署完成

恭喜！您已成功在阿里云服务器上部署了企业微信登录API服务。

**服务地址**: https://api.lead-service.vld.com.cn
**健康检查**: https://api.lead-service.vld.com.cn/api/health

请确保：
1. ✅ SSL证书配置正确
2. ✅ 前端API地址已更新
3. ✅ 企业微信回调地址配置正确
4. ✅ 监控和备份策略已设置
