# Nginx代理服务 PRD 文档

## 项目概述

### 项目名称
CRM Web Nginx代理服务

### 项目背景
为解决CRM Web应用在HTTPS环境下的混合内容问题，需要部署一个Nginx代理服务，将HTTPS请求代理到HTTP的Supabase服务，同时提供SSL终止和静态文件服务功能。

### 项目目标
- 解决HTTPS页面访问HTTP资源的混合内容问题
- 提供高性能的静态文件服务
- 实现SSL证书管理和自动续期
- 提供健康检查和监控功能

## 技术架构

### 系统架构图
```
用户请求 → Nginx代理服务器 → 目标服务
                ↓
        1. 静态文件服务 (React应用)
        2. Supabase代理 (172.29.115.115:8000)
        3. 其他API代理 (可选)
```

### 技术栈
- **Nginx**: 1.18+ (Ubuntu 20.04+)
- **SSL**: Let's Encrypt + Certbot
- **监控**: Nginx状态模块
- **日志**: Nginx访问日志 + 错误日志

## 功能需求

### 1. 核心功能

#### 1.1 HTTPS代理服务
- **功能描述**: 提供HTTPS入口，处理SSL终止
- **技术要求**:
  - 支持TLS 1.2/1.3协议
  - 自动HTTP到HTTPS重定向
  - 安全头配置
- **验收标准**:
  - 所有HTTP请求自动重定向到HTTPS
  - SSL评级达到A级
  - 支持HSTS安全传输

#### 1.2 Supabase代理
- **功能描述**: 将`/supabase/*`请求代理到HTTP的Supabase服务
- **技术要求**:
  - 支持WebSocket升级
  - 保持原始请求头
  - 错误处理和重试机制
- **验收标准**:
  - 成功代理所有Supabase API请求
  - WebSocket连接正常工作
  - 错误响应正确返回

#### 1.3 静态文件服务
- **功能描述**: 提供React应用的静态文件服务
- **技术要求**:
  - 支持SPA路由
  - 静态资源缓存优化
  - Gzip压缩
- **验收标准**:
  - 所有静态资源正确加载
  - 缓存策略生效
  - 压缩率>70%

### 2. 扩展功能

#### 2.1 健康检查
- **功能描述**: 提供系统健康状态检查接口
- **技术要求**:
  - 返回JSON格式状态信息
  - 包含代理服务状态
  - 支持监控系统集成
- **验收标准**:
  - `/health`端点返回200状态码
  - 包含时间戳和版本信息

#### 2.2 监控和日志
- **功能描述**: 提供访问日志和错误日志
- **技术要求**:
  - 结构化日志格式
  - 日志轮转配置
  - 错误告警机制
- **验收标准**:
  - 日志文件正确生成
  - 日志轮转正常工作
  - 错误日志可追踪

## 非功能需求

### 1. 性能要求
- **响应时间**: 静态文件<100ms，代理请求<500ms
- **并发处理**: 支持1000+并发连接
- **吞吐量**: 支持10MB/s文件传输

### 2. 可用性要求
- **服务可用性**: 99.9%
- **故障恢复**: 自动重启机制
- **备份策略**: 配置文件备份

### 3. 安全要求
- **SSL安全**: 使用强加密算法
- **访问控制**: IP白名单支持
- **安全头**: 完整的安全头配置

## 部署架构

### 1. 服务器要求
- **操作系统**: Ubuntu 20.04 LTS
- **CPU**: 2核心
- **内存**: 2GB
- **存储**: 20GB SSD
- **网络**: 公网IP，开放80/443端口

### 2. 域名配置
- **主域名**: lead-service.vld.com.cn
- **SSL证书**: Let's Encrypt免费证书
- **DNS解析**: A记录指向服务器IP

### 3. 服务配置
- **Nginx版本**: 1.18+
- **服务端口**: 80 (HTTP), 443 (HTTPS)
- **日志路径**: /var/log/nginx/
- **配置路径**: /etc/nginx/

## 配置规范

### 1. Nginx主配置
```nginx
# /etc/nginx/nginx.conf
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # 性能优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # 包含站点配置
    include /etc/nginx/sites-enabled/*;
}
```

### 2. 站点配置
```nginx
# /etc/nginx/conf.d/lead-service.conf
server {
    server_name lead-service.vld.com.cn;
    
    # 静态资源缓存优化
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /var/www/crm-web;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        try_files $uri =404;
    }

    # 企业微信API - 支持长轮询
    location /api/auth/wecom/ { 
        proxy_pass http://127.0.0.1:3001/api/auth/wecom/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 660s;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        
        # CORS支持
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }

    # 健康检查API
    location /api/health {
        proxy_pass http://127.0.0.1:3001/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }

    # 其他API（通用配置）
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_buffering on;
        
        # CORS支持
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
        
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }   

    # Supabase API代理配置
    location /supabase/ {
        proxy_pass http://172.29.115.115:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支持WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        
        # 超时设置
        proxy_connect_timeout 5s;
        
        # CORS头
        proxy_hide_header Access-Control-Allow-Origin;
        proxy_hide_header Access-Control-Allow-Methods;
        proxy_hide_header Access-Control-Allow-Headers;
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, apikey, x-client-info, x-supabase-api-version";
        
        # 处理OPTIONS请求
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With, apikey, x-client-info, x-supabase-api-version";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain charset=UTF-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # 健康检查端点
    location /health {
        return 200 '{"status":"healthy","timestamp":"$time_iso8601","service":"crm-web","version":"1.0.0"}';
        add_header Content-Type application/json;
        access_log off;
    }

    # 静态文件服务（React应用）
    location / {
        root /var/www/crm-web;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/lead-service.vld.com.cn/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/lead-service.vld.com.cn/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = lead-service.vld.com.cn) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name lead-service.vld.com.cn;
    return 404; # managed by Certbot
}
```

## 部署流程

### 1. 环境准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Nginx
sudo apt install -y nginx

# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 安装其他工具
sudo apt install -y curl wget unzip
```

### 2. 配置部署
```bash
# 创建网站目录
sudo mkdir -p /var/www/crm-web

# 复制配置文件
sudo cp nginx.conf /etc/nginx/nginx.conf
sudo cp lead-service.conf /etc/nginx/conf.d/lead-service.conf

# 测试配置
sudo nginx -t

# 重启服务
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 3. SSL证书配置
```bash
# 获取Let's Encrypt证书
sudo certbot --nginx -d lead-service.vld.com.cn --non-interactive --agree-tos --email admin@lead-service.vld.com.cn

# 设置自动续期
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 4. 监控配置
```bash
# 安装监控工具
sudo apt install -y htop iotop nethogs

# 配置日志轮转
sudo tee /etc/logrotate.d/nginx << 'EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 nginx adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF
```

## 测试方案

### 1. 功能测试
- **HTTPS重定向测试**: 访问http://lead-service.vld.com.cn，验证重定向到HTTPS
- **静态文件测试**: 访问https://lead.vld.com.cn，验证页面正常加载
- **Supabase代理测试**: 访问https://lead-service.vld.com.cn/supabase/auth/v1/token，验证代理成功
- **WebSocket测试**: 验证实时功能正常工作
- **健康检查测试**: 访问https://lead.vld.com.cn/health，验证状态返回

### 2. 性能测试
- **压力测试**: 使用ab工具进行并发测试
- **SSL性能测试**: 使用SSL Labs测试SSL配置
- **缓存测试**: 验证静态资源缓存策略

### 3. 安全测试
- **SSL安全测试**: 验证SSL配置安全性
- **安全头测试**: 验证安全头配置
- **CORS测试**: 验证跨域请求处理

## 监控和维护

### 1. 监控指标
- **服务状态**: Nginx进程状态
- **响应时间**: 平均响应时间
- **错误率**: 4xx/5xx错误率
- **SSL证书**: 证书过期时间
- **磁盘使用**: 日志文件大小

### 2. 告警机制
- **服务宕机**: Nginx进程停止
- **SSL证书**: 证书30天内过期
- **错误率**: 5xx错误率>5%
- **磁盘空间**: 使用率>80%

### 3. 维护计划
- **日常检查**: 服务状态、日志文件
- **周度检查**: 性能指标、安全更新
- **月度检查**: SSL证书、配置优化

## 风险评估

### 1. 技术风险
- **SSL证书过期**: 自动续期失败
- **配置错误**: 导致服务不可用
- **性能瓶颈**: 高并发下性能下降

### 2. 运维风险
- **服务器故障**: 单点故障风险
- **网络问题**: 网络连接中断
- **安全漏洞**: 配置不当导致安全风险

### 3. 缓解措施
- **备份策略**: 配置文件备份
- **监控告警**: 实时监控和告警
- **文档维护**: 完整的操作文档

## 项目时间计划

### 第一阶段：环境准备 (1天)
- 服务器环境配置
- Nginx安装和基础配置
- 域名解析配置

### 第二阶段：核心功能开发 (2天)
- Nginx配置文件编写
- SSL证书配置
- 代理功能测试

### 第三阶段：测试和优化 (1天)
- 功能测试
- 性能测试
- 安全测试

### 第四阶段：部署上线 (1天)
- 生产环境部署
- 监控配置
- 文档整理

## 验收标准

### 1. 功能验收
- ✅ 所有HTTP请求自动重定向到HTTPS
- ✅ 静态文件正常加载
- ✅ Supabase代理功能正常
- ✅ WebSocket连接正常
- ✅ 健康检查端点正常

### 2. 性能验收
- ✅ 静态文件响应时间<100ms
- ✅ 代理请求响应时间<500ms
- ✅ 支持1000+并发连接
- ✅ SSL评级达到A级

### 3. 安全验收
- ✅ SSL配置安全
- ✅ 安全头配置完整
- ✅ CORS配置正确
- ✅ 无安全漏洞

## 附录

### A. 配置文件模板
- nginx.conf
- crm-web.conf
- logrotate配置
- systemd服务配置

### B. 部署脚本
- 环境准备脚本
- 配置部署脚本
- SSL证书配置脚本
- 监控配置脚本

### C. 测试脚本
- 功能测试脚本
- 性能测试脚本
- 安全测试脚本

### D. 监控配置
- 监控指标配置
- 告警规则配置
- 日志分析配置

---

**文档版本**: v2.0  
**创建日期**: 2024年12月  
**最后更新**: 2025年9月  
**负责人**: 开发团队
