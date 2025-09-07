# SPA路由问题修复指南

## 🔍 问题描述

在 `https://lead-service.vld.com.cn/login` 路由刷新页面时出现500错误。

## 🎯 问题原因

当前的Nginx配置只处理API请求，对于前端路由请求返回404，导致单页应用(SPA)无法正常处理路由刷新。

## 🛠️ 解决方案

### 方法一：使用自动修复脚本（推荐）

```bash
# 在服务器上执行
cd /path/to/your/backend
chmod +x fix-spa-routing.sh
sudo ./fix-spa-routing.sh
```

### 方法二：手动修复

1. **备份当前配置**
```bash
sudo cp /etc/nginx/conf.d/crm-wecom-api.conf /etc/nginx/conf.d/crm-wecom-api.conf.backup
```

2. **更新Nginx配置**
```bash
sudo nano /etc/nginx/conf.d/crm-wecom-api.conf
```

3. **添加以下配置到server块中**
```nginx
# 静态文件根目录
root /var/www/html;
index index.html;

# 静态资源文件
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
}

# 前端路由支持
location / {
    try_files $uri $uri/ /index.html;
    
    # 防止缓存index.html
    location = /index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}

# 错误页面
error_page 404 /index.html;
error_page 500 502 503 504 /index.html;
```

4. **替换原来的location /块**
```nginx
# 删除这行：
# location / {
#     return 404;
# }
```

5. **测试并重载配置**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 📋 配置说明

### 关键配置解释

1. **`try_files $uri $uri/ /index.html;`**
   - 首先尝试访问请求的文件
   - 如果文件不存在，尝试访问目录
   - 最后返回 `index.html`，让前端路由处理

2. **静态资源缓存**
   - CSS、JS、图片等静态资源设置1年缓存
   - 提高页面加载性能

3. **index.html防缓存**
   - 确保前端应用更新时能立即生效

4. **错误页面重定向**
   - 所有错误都重定向到 `index.html`
   - 让前端应用处理错误显示

## 🧪 测试验证

修复后，以下操作应该正常工作：

1. ✅ 访问 `https://lead-service.vld.com.cn/login`
2. ✅ 刷新页面不再出现500错误
3. ✅ 其他前端路由刷新也正常工作
4. ✅ API请求继续正常响应

## 🔧 故障排除

### 如果修复后仍有问题

1. **检查前端文件是否存在**
```bash
ls -la /var/www/html/
```

2. **检查Nginx错误日志**
```bash
sudo tail -f /var/log/nginx/error.log
```

3. **检查Nginx配置语法**
```bash
sudo nginx -t
```

4. **重启Nginx服务**
```bash
sudo systemctl restart nginx
```

## 📞 技术支持

如果遇到问题，请提供以下信息：
- 错误信息截图
- Nginx错误日志
- 服务器配置信息

---

**修复完成后，SPA路由刷新问题将得到解决！** 🎉
