# HTTPS环境配置说明

## 问题描述
您的应用在HTTPS环境下运行（`https://lead.vld.com.cn/`），但Supabase服务器使用HTTP协议（`http://172.29.115.115:8000`），导致浏览器阻止混合内容请求。

**重要说明**：这是浏览器的安全策略，即使您的服务器接受HTTP连接，浏览器也会阻止HTTPS页面访问HTTP资源。

## 解决方案

### 方案1：配置Nginx反向代理（推荐）

在您的服务器上配置Nginx反向代理：

```nginx
server {
    listen 443 ssl;
    server_name lead.vld.com.cn;
    
    # SSL证书配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
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
    }
}
```

### 方案2：环境变量配置

创建 `.env.production` 文件：

```env
VITE_SUPABASE_URL=https://lead.vld.com.cn/supabase
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg
```

### 方案3：阿里云内网配置

由于您的项目在阿里云上，使用内网连接：

```nginx
# Nginx配置 - 代理到阿里云内网
location /supabase/ {
    proxy_pass http://172.29.115.115:8000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

**注意**：内网地址 `172.29.115.115:8000` 只能在阿里云内网访问，外部无法直接连接。

## 验证方法

配置完成后，在浏览器控制台中测试：

```javascript
// 测试API连接
fetch('https://lead.vld.com.cn/supabase/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(response => console.log('API连接成功:', response))
.catch(error => console.error('API连接失败:', error));

// 测试WebSocket连接
const ws = new WebSocket('wss://lead.vld.com.cn/supabase/realtime/v1/websocket');
ws.onopen = () => console.log('WebSocket连接成功');
ws.onerror = (error) => console.error('WebSocket连接失败:', error);
```

## 当前修改

已修改 `src/supaClient.ts` 文件：
1. ✅ 添加了环境检测逻辑
2. ✅ 在HTTPS环境下自动使用代理地址
3. ✅ 添加了调试信息输出
4. ✅ 保持realtime功能启用
5. ✅ 确保WebSocket使用WSS协议

## 下一步

1. 配置Nginx反向代理（推荐）
2. 或者设置环境变量 `VITE_SUPABASE_URL=https://lead.vld.com.cn/supabase`
3. 重新构建和部署应用
