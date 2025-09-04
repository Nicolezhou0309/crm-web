# HTTPS页面连接HTTP服务器解决方案

## 问题描述

您的应用部署在HTTPS环境（`https://lead.vld.com.cn/`），但Supabase服务器使用HTTP协议（`http://47.123.26.25:8000`），导致浏览器阻止混合内容请求。

## 解决方案

### 方案1：配置Nginx反向代理（推荐）

在您的服务器上配置Nginx反向代理，将HTTPS请求转发到HTTP后端：

```nginx
server {
    listen 443 ssl;
    server_name lead.vld.com.cn;
    
    # SSL证书配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # 代理Supabase API请求
    location /supabase/ {
        proxy_pass http://47.123.26.25:8000/;
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

然后修改环境变量：
```env
VITE_SUPABASE_URL=https://lead.vld.com.cn/supabase
```

### 方案2：配置Apache反向代理

如果您使用Apache，可以这样配置：

```apache
<VirtualHost *:443>
    ServerName lead.vld.com.cn
    SSLEngine on
    SSLCertificateFile /path/to/your/cert.pem
    SSLCertificateKeyFile /path/to/your/key.pem
    
    # 代理Supabase请求
    ProxyPreserveHost On
    ProxyPass /supabase/ http://47.123.26.25:8000/
    ProxyPassReverse /supabase/ http://47.123.26.25:8000/
    
    # WebSocket支持
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/supabase/(.*)$ "ws://47.123.26.25:8000/$1" [P,L]
</VirtualHost>
```

### 方案3：配置阿里云负载均衡器

如果您使用阿里云，可以配置SLB（Server Load Balancer）：

1. 创建HTTPS监听器
2. 配置SSL证书
3. 将HTTPS流量转发到HTTP后端（47.123.26.25:8000）
4. 配置健康检查

### 方案4：临时解决方案 - 浏览器配置

**仅用于开发测试，不推荐生产环境：**

1. **Chrome浏览器**：
   - 启动时添加参数：`--disable-web-security --user-data-dir=/tmp/chrome_dev`
   - 或在地址栏输入：`chrome://flags/#block-insecure-private-network-requests` 并禁用

2. **Firefox浏览器**：
   - 在地址栏输入：`about:config`
   - 搜索：`security.mixed_content.block_active_content`
   - 设置为：`false`

### 方案5：修改应用配置

如果您有控制权，可以修改应用配置：

```typescript
// 在 src/supaClient.ts 中添加环境检测
const isProduction = process.env.NODE_ENV === 'production';
const isHTTPS = typeof window !== 'undefined' && window.location.protocol === 'https:';

if (!supabaseUrl) {
  if (isProduction && isHTTPS) {
    // 生产环境HTTPS使用代理
    supabaseUrl = 'https://lead.vld.com.cn/supabase';
  } else {
    // 开发环境直接使用HTTP
    supabaseUrl = 'http://47.123.26.25:8000';
  }
}
```

## 推荐实施步骤

1. **短期**：使用方案4进行开发测试
2. **中期**：实施方案1（Nginx代理）或方案3（阿里云SLB）
3. **长期**：考虑为Supabase服务器配置HTTPS支持

## 验证方法

配置完成后，可以通过以下方式验证：

```javascript
// 在浏览器控制台中测试
fetch('https://lead.vld.com.cn/supabase/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ grant_type: 'password' })
})
.then(response => console.log('API连接成功:', response))
.catch(error => console.error('API连接失败:', error));

// 测试WebSocket连接
const ws = new WebSocket('wss://lead.vld.com.cn/supabase/realtime/v1/websocket');
ws.onopen = () => console.log('WebSocket连接成功');
ws.onerror = (error) => console.error('WebSocket连接失败:', error);
```

## 注意事项

- 方案1和2需要服务器管理权限
- 方案3需要阿里云账户和配置权限
- 方案4仅适用于开发环境
- 所有方案都需要确保WebSocket连接也能正常工作
