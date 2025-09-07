# 服务器配置总结

## 🚀 部署状态

- **部署状态**: ✅ 已部署并运行正常
- **API地址**: `https://lead-service.vld.com.cn/api`
- **部署时间**: 2025-09-07 13:00
- **最后更新**: 2025-09-07 14:41

## 🖥️ 服务器基本信息

### 系统环境
```bash
服务器IP: 8.159.132.181
操作系统: Alibaba Cloud Linux 3.2104 (OpenAnolis Edition)
内核版本: Linux 5.10.134-19.1.al8.x86_64
架构: x86_64
```

### 软件环境
```bash
Node.js: v18.20.8
npm: 10.8.2
Nginx: 1.20.1
PM2: 最新版（部署时安装）
```

### 网络配置
```bash
公网IP: 8.159.132.181
内网IP: 172.20.x.x
开放端口: 22, 80, 443, 8000
```

## 🔧 服务配置

### 1. 企业微信登录API服务

#### 服务信息
```bash
服务名称: crm-wecom-api
运行端口: 3001 (内部)
进程管理: PM2
工作目录: /opt/crm-wecom-api
```

#### 环境变量
```bash
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://lead-service.vld.com.cn
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=sXQeFCLDQJkwrX5lMWDzBTEIiHK1J7-a2e7chPyqYxY
WECOM_REDIRECT_URI=https://lead-service.vld.com.cn/auth/wecom/callback
```

#### PM2配置
```javascript
{
  name: 'crm-wecom-api',
  script: 'server.js',
  instances: 1,
  exec_mode: 'fork',
  max_memory_restart: '1G',
  node_args: '--max-old-space-size=1024'
}
```

### 2. Nginx反向代理

#### 配置文件位置
```bash
主配置: /etc/nginx/nginx.conf
API配置: /etc/nginx/conf.d/crm-wecom-api.conf
日志目录: /var/log/nginx/
```

#### 虚拟主机配置
```nginx
# API服务域名
server_name: lead-service.vld.com.cn

# 上游服务器
upstream wecom_api {
    server 127.0.0.1:3001;
}

# 代理配置
location /api/auth/wecom/ {
    proxy_pass http://wecom_api/api/auth/wecom/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 3. SSL/TLS配置

#### 当前配置
```bash
证书类型: 自签名证书（临时）
证书文件: /etc/ssl/certs/ssl-cert-snakeoil.pem
私钥文件: /etc/ssl/private/ssl-cert-snakeoil.key
协议版本: TLSv1.2, TLSv1.3
```

#### 推荐配置
```bash
证书类型: Let's Encrypt 或 阿里云SSL证书
证书文件: /etc/letsencrypt/live/lead-service.vld.com.cn/fullchain.pem
私钥文件: /etc/letsencrypt/live/lead-service.vld.com.cn/privkey.pem
```

## 📁 目录结构

### 应用目录
```bash
/opt/crm-wecom-api/           # API服务根目录
├── server.js                 # 主服务文件
├── package.json              # 项目配置
├── .env                      # 环境变量
├── ecosystem.config.js       # PM2配置
└── node_modules/             # 依赖包
```

### 网站目录
```bash
/var/www/                     # 网站根目录
├── crm-web/                  # 现有CRM网站
├── html/                     # 默认网站
└── lead-service/             # 其他服务
```

### 日志目录
```bash
/var/log/
├── pm2/                      # PM2日志
│   ├── crm-wecom-api.log
│   ├── crm-wecom-api-error.log
│   └── crm-wecom-api-out.log
└── nginx/                    # Nginx日志
    ├── access.log
    └── error.log
```

### 配置文件目录
```bash
/etc/
├── nginx/                    # Nginx配置
│   ├── nginx.conf
│   └── conf.d/
│       └── crm-wecom-api.conf
└── ssl/                      # SSL证书
    ├── certs/
    └── private/
```

## 🔒 安全配置

### 防火墙配置
```bash
# 使用iptables（当前配置）
Chain INPUT (policy ACCEPT)
Chain FORWARD (policy DROP)
Chain OUTPUT (policy ACCEPT)

# 开放端口
22   - SSH管理
80   - HTTP
443  - HTTPS
8000 - Docker服务
```

### 安全头配置
```nginx
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 速率限制
```javascript
// API速率限制
windowMs: 15 * 60 * 1000,  // 15分钟
max: 100,                  // 最多100个请求
```

## 📊 监控配置

### 服务监控
```bash
# PM2监控
pm2 status                  # 查看服务状态
pm2 logs crm-wecom-api      # 查看日志
pm2 monit                   # 实时监控

# 系统监控
htop                        # 系统资源
df -h                       # 磁盘使用
free -h                     # 内存使用
netstat -tlnp               # 端口监听
```

### 日志轮转
```bash
# PM2日志轮转
pm2 install pm2-logrotate

# 系统日志轮转
/etc/logrotate.d/
```

## 🚀 部署配置

### 部署流程
```bash
1. 上传代码包到 /tmp/
2. 从 /tmp/ 解压到 /opt/crm-wecom-api/
3. 安装依赖: npm install --production
4. 配置环境变量: .env
5. 启动服务: pm2 start ecosystem.config.js
6. 配置Nginx: /etc/nginx/conf.d/crm-wecom-api.conf
7. 重载Nginx: systemctl reload nginx
8. 设置开机自启: pm2 startup
```

### 备份配置
```bash
# 应用备份
/opt/crm-wecom-api/         # 完整应用目录

# 配置备份
/etc/nginx/conf.d/crm-wecom-api.conf
/opt/crm-wecom-api/.env
/opt/crm-wecom-api/ecosystem.config.js

# 日志备份
/var/log/pm2/
/var/log/nginx/
```

## 🔧 维护配置

### 服务管理命令
```bash
# PM2管理
pm2 start crm-wecom-api     # 启动服务
pm2 stop crm-wecom-api      # 停止服务
pm2 restart crm-wecom-api   # 重启服务
pm2 delete crm-wecom-api    # 删除服务
pm2 save                    # 保存配置

# Nginx管理
systemctl start nginx       # 启动Nginx
systemctl stop nginx        # 停止Nginx
systemctl restart nginx     # 重启Nginx
systemctl reload nginx      # 重载配置
nginx -t                    # 测试配置

# 系统管理
systemctl status nginx      # 查看Nginx状态
systemctl enable nginx      # 设置开机自启
systemctl enable pm2        # 设置PM2开机自启
```

### 更新流程
```bash
1. 备份当前版本
2. 停止服务: pm2 stop crm-wecom-api
3. 更新代码
4. 安装依赖: npm install --production
5. 启动服务: pm2 start crm-wecom-api
6. 测试功能
7. 清理备份
```

## 📋 检查清单

### 部署前检查
- [ ] 服务器环境满足要求
- [ ] 域名解析正确
- [ ] 端口开放正确
- [ ] SSL证书配置
- [ ] 环境变量配置
- [ ] 依赖包安装

### 部署后检查
- [ ] 服务启动正常
- [ ] API接口可访问
- [ ] 日志输出正常
- [ ] 性能指标正常
- [ ] 安全配置生效
- [ ] 监控告警配置

### 定期维护检查
- [ ] 服务状态检查
- [ ] 日志文件清理
- [ ] 性能指标监控
- [ ] 安全漏洞扫描
- [ ] 备份文件验证
- [ ] 依赖包更新

## 📞 联系信息

### 技术支持
- **服务器管理**: 系统管理员
- **应用开发**: 开发团队
- **运维支持**: 运维团队

### 紧急联系
- **服务故障**: 24小时技术支持
- **安全事件**: 安全团队
- **数据备份**: 数据管理员

### 文档更新
- **最后更新**: 2024-01-01
- **版本**: v1.0.0
- **维护者**: 技术团队
