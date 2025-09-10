# 混合内容错误解决方案

## 问题描述

当应用部署到HTTPS环境（如Vercel）时，如果Supabase使用HTTP协议，会出现以下错误：

```
Mixed Content: The page at 'https://your-app.vercel.app/' was loaded over HTTPS, but attempted to connect to the insecure WebSocket endpoint 'ws://47.123.26.25:8000/realtime/v1/websocket'
```

## 错误原因

- 应用运行在HTTPS协议
- Supabase服务器配置为HTTP协议
- 浏览器安全策略阻止从HTTPS页面连接到不安全的WebSocket端点

## 解决方案

⚠️ **重要发现**: 经测试，`47.123.26.25:8000`只支持HTTP协议，不支持HTTPS。

### 方案1：配置Supabase服务器支持HTTPS（推荐）

您需要在阿里云配置HTTPS支持：

1. **申请SSL证书**：
   - 为域名申请SSL证书
   - 或为IP地址配置自签名证书

2. **配置负载均衡器**：
   - 在阿里云SLB中配置HTTPS监听
   - 将HTTPS流量转发到HTTP后端

### 方案2：临时使用HTTP（需要修改Vercel配置）

1. **创建.env文件**（在项目根目录）：
```env
# Supabase 配置（必需）- 目前只能使用HTTP
VITE_SUPABASE_URL=172.29.115.115:8000
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE

# 企业微信配置（可选）
VITE_WECOM_CORP_ID=ww68a125fce698cb59
VITE_WECOM_AGENT_ID=1000002
VITE_WECOM_REDIRECT_URI=https://your-domain.com/auth/wecom/callback
```

2. **⚠️ 问题**: Vercel不允许HTTPS应用连接HTTP服务器

### 方案3：使用代理服务器（推荐的临时解决方案）

创建一个HTTPS代理来转发请求到HTTP Supabase：

1. **使用Cloudflare Workers**：
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const target = `172.29.115.115:8000${url.pathname}${url.search}`
  
  const response = await fetch(target, {
    method: request.method,
    headers: request.headers,
    body: request.body
  })
  
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': '*'
    }
  })
}
```

2. **更新环境变量使用代理URL**：
```env
VITE_SUPABASE_URL=https://your-worker.your-domain.workers.dev
```

### 方案4：临时解决方案（仅开发环境）

⚠️ **不推荐用于生产环境**

在开发环境中，可以禁用浏览器的混合内容检查：

```bash
# Chrome启动参数
--disable-web-security --disable-features=VizDisplayCompositor --allow-running-insecure-content
```

## 验证修复

修复后，检查以下内容：

1. **WebSocket连接**：
   - 打开浏览器开发者工具
   - 查看Network标签页
   - 确认WebSocket连接使用 `wss://` 协议

2. **实时功能**：
   - 测试实时通知
   - 测试数据同步

3. **控制台错误**：
   - 确认没有Mixed Content错误
   - 确认没有WebSocket连接失败

## 注意事项

1. **HTTPS要求**：生产环境必须使用HTTPS
2. **WebSocket协议**：HTTPS页面只能连接到WSS端点
3. **证书验证**：确保SSL证书有效且未过期
4. **防火墙配置**：确保HTTPS端口（443）可访问

## 相关文档

- [Supabase配置文档](./SUPABASE_CONFIG.md)
- [部署指南](./DEPLOYMENT_GUIDE.md)
- [环境变量配置](./ENV_SETUP_GUIDE.md)
