# SSL协议错误修复指南

## 问题描述

当应用部署到HTTPS环境（如Vercel）时，如果Supabase服务器只支持HTTP协议，会出现以下错误：

```
POST https://47.123.26.25:8000/auth/v1/token?grant_type=password net::ERR_SSL_PROTOCOL_ERROR
```

## 错误原因

- 应用运行在HTTPS协议
- Supabase服务器 `47.123.26.25:8000` 只支持HTTP协议，不支持HTTPS
- 浏览器安全策略阻止从HTTPS页面连接到不安全的HTTP端点

## 解决方案

### 方案1：配置环境变量使用HTTP（当前实现）

应用已自动配置为使用HTTP协议连接到Supabase服务器：

```typescript
// 默认使用HTTP协议
const supabaseUrl = 'http://47.123.26.25:8000'
```

### 方案2：在Vercel中配置环境变量

在Vercel项目设置中添加环境变量：

```env
VITE_SUPABASE_URL=http://47.123.26.25:8000
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg
```

### 方案3：配置HTTPS代理（推荐的生产环境解决方案）

#### 3.1 使用Vercel代理

在 `vercel.json` 中配置代理：

```json
{
  "rewrites": [
    {
      "source": "/api/supabase/:path*",
      "destination": "http://47.123.26.25:8000/:path*"
    }
  ]
}
```

然后修改Supabase URL为：
```env
VITE_SUPABASE_URL=https://your-domain.vercel.app/api/supabase
```

#### 3.2 使用Nginx反向代理

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /supabase/ {
        proxy_pass http://47.123.26.25:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 方案4：配置阿里云负载均衡器支持HTTPS

1. 在阿里云SLB中配置HTTPS监听器
2. 将HTTPS流量转发到HTTP后端（47.123.26.25:8000）
3. 配置SSL证书

## 当前状态

✅ **已修复的问题：**
- WebSocket混合内容错误
- JWT认证错误处理
- SSL协议错误（使用HTTP协议）

⚠️ **注意事项：**
- 当前使用HTTP协议，在HTTPS环境下可能仍有混合内容警告
- 建议在生产环境中配置HTTPS代理或负载均衡器

## 测试验证

1. 检查网络请求是否成功：
   ```javascript
   // 在浏览器控制台中
   fetch('http://47.123.26.25:8000/auth/v1/token', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ grant_type: 'password' })
   })
   ```

2. 检查WebSocket连接：
   ```javascript
   const ws = new WebSocket('ws://47.123.26.25:8000/realtime/v1/websocket');
   ws.onopen = () => console.log('WebSocket连接成功');
   ws.onerror = (error) => console.error('WebSocket连接失败:', error);
   ```

## 下一步建议

1. **短期**：使用当前HTTP配置进行开发和测试
2. **中期**：配置Vercel代理或Nginx反向代理
3. **长期**：在阿里云配置HTTPS负载均衡器
