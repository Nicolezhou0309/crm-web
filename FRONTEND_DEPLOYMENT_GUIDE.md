# 企业微信长轮询前端部署指南

## 📦 部署包信息

- **文件名**: `crm-frontend-long-polling-20250907-171649.tar.gz`
- **大小**: 1.7 MB
- **包含内容**: 完整的前端构建文件（dist目录）

## 🚀 部署步骤

### 1. 上传部署包到服务器

```bash
# 上传到服务器
scp crm-frontend-long-polling-20250907-171649.tar.gz root@your-server:/tmp/
```

### 2. 在服务器上部署

```bash
# SSH登录服务器
ssh root@your-server

# 进入临时目录
cd /tmp

# 解压部署包
tar -xzf crm-frontend-long-polling-20250907-171649.tar.gz

# 备份现有前端文件（如果存在）
if [ -d "/var/www/html" ]; then
    cp -r /var/www/html /var/www/html.backup.$(date +%Y%m%d-%H%M%S)
fi

# 部署新文件
cp -r dist/* /var/www/html/

# 设置正确的权限
chown -R nginx:nginx /var/www/html/
chmod -R 755 /var/www/html/
```

### 3. 配置Nginx（如果需要）

```bash
# 检查Nginx配置
nginx -t

# 如果配置正确，重新加载Nginx
systemctl reload nginx

# 检查Nginx状态
systemctl status nginx
```

### 4. 验证部署

```bash
# 检查文件是否部署成功
ls -la /var/www/html/

# 测试前端访问
curl -I "https://lead.vld.com.cn/"

# 检查企业微信登录页面
curl -I "https://lead.vld.com.cn/auth/wecom"
```

## 🔧 新功能特性

### 长轮询登录
- **技术**: 使用fetch API进行长轮询
- **端点**: `/api/auth/wecom/poll`
- **实时性**: 状态改变时立即响应
- **性能**: 比短轮询效率高4倍

### 二维码过期机制
- **有效期**: 3分钟
- **自动刷新**: 过期后提示重新生成
- **状态显示**: 实时显示连接状态

### 用户体验优化
- **连接状态**: 显示"正在监听登录状态"
- **错误处理**: 优雅的错误提示和重试机制
- **自动重连**: 网络断开时自动重连

## 📊 技术对比

| 特性 | 短轮询 | 长轮询 |
|------|--------|--------|
| 网络请求 | 每1秒1次 | 单次连接 |
| 服务器负载 | 高 | 低 |
| 实时性 | 1秒延迟 | 立即响应 |
| 用户体验 | 一般 | 优秀 |

## 🔍 测试命令

```bash
# 1. 检查前端文件
ls -la /var/www/html/

# 2. 测试主页访问
curl -I "https://lead.vld.com.cn/"

# 3. 测试企业微信登录页面
curl -I "https://lead.vld.com.cn/auth/wecom"

# 4. 检查静态资源
curl -I "https://lead.vld.com.cn/assets/index-*.js"
curl -I "https://lead.vld.com.cn/assets/index-*.css"
```

## ⚠️ 注意事项

1. **环境变量**: 确保前端能正确访问后端API
2. **CORS配置**: 确保后端允许前端域名的跨域请求
3. **SSL证书**: 确保HTTPS配置正确
4. **缓存清理**: 部署后可能需要清理浏览器缓存

## 🆘 故障排除

### 如果前端无法访问
- 检查Nginx配置
- 确认文件权限正确
- 检查SSL证书有效性

### 如果长轮询不工作
- 检查后端API是否正常运行
- 确认CORS配置正确
- 查看浏览器控制台错误

### 如果二维码不显示
- 检查后端二维码生成API
- 确认企业微信配置正确
- 查看网络请求状态

## 📞 支持

如有问题，请检查：
1. 浏览器控制台错误
2. 网络请求状态
3. 后端API健康状态
4. Nginx配置和日志
