# 阿里云HTTPS部署指南

## 🚨 问题说明

您的应用在HTTPS环境下运行，但数据库使用HTTP协议，浏览器会阻止这种"混合内容"请求。

**关键点**：
- 浏览器安全策略：HTTPS页面不能访问HTTP资源
- 即使服务器接受HTTP连接，浏览器也会阻止
- 必须通过反向代理解决

## 🔧 解决方案

### 1. 配置Nginx反向代理

将以下配置添加到您的Nginx配置文件中：

```nginx
server {
    listen 443 ssl;
    server_name lead.vld.com.cn;
    
    # SSL证书配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # 静态文件服务
    location / {
        root /path/to/your/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 代理Supabase API请求到阿里云内网
    location /supabase/ {
        proxy_pass http://172.29.115.115:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 2. 部署应用

```bash
# 构建应用
npm run build

# 上传dist目录到服务器
scp -r dist/* user@your-server:/path/to/web/root/

# 重启Nginx
sudo nginx -t && sudo nginx -s reload
```

### 3. 验证部署

在浏览器控制台中运行：

```javascript
// 测试API连接
fetch('https://lead.vld.com.cn/supabase/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(response => console.log('✅ API连接成功:', response.status))
.catch(error => console.log('❌ API连接失败:', error));

// 测试WebSocket连接
const ws = new WebSocket('wss://lead.vld.com.cn/supabase/realtime/v1/websocket');
ws.onopen = () => console.log('✅ WebSocket连接成功');
ws.onerror = (error) => console.log('❌ WebSocket连接失败:', error);
```

## 📋 当前配置

应用已配置为：
- ✅ 自动检测HTTPS环境
- ✅ 在HTTPS环境下使用代理地址
- ✅ 保持realtime功能启用
- ✅ 使用阿里云内网地址 `172.29.115.115:8000`

## 🎯 预期结果

部署后，浏览器控制台应该显示：
```
🔧 Supabase配置信息: {
  isHTTPS: true,
  supabaseUrl: "https://lead.vld.com.cn/supabase",
  websocketUrl: "wss://lead.vld.com.cn/supabase/realtime/v1/websocket",
  environment: "阿里云内网"
}
```

并且不再出现混合内容错误。

## ⚠️ 注意事项

1. **内网地址**：`172.29.115.115:8000` 只能在阿里云内网访问
2. **SSL证书**：确保SSL证书配置正确
3. **防火墙**：确保8000端口在内网可访问
4. **测试**：部署后务必测试所有功能
