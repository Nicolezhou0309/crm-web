# 函数计算环境HTTPS混合内容解决方案

## 问题描述
您的应用部署在阿里云函数计算环境（`https://lead.vld.com.cn/`），但Supabase服务器使用HTTP协议（`http://47.123.26.25:8000`），导致浏览器阻止混合内容请求。

**重要说明**：这是浏览器的安全策略，即使您的服务器接受HTTP连接，浏览器也会阻止HTTPS页面访问HTTP资源。

## 解决方案

### 方案1：API网关代理（推荐）

在阿里云控制台配置API网关：

1. **创建API网关服务**
   - 进入阿里云API网关控制台
   - 创建API分组
   - 配置HTTPS监听器

2. **配置代理规则**
   ```yaml
   API路径: /supabase/*
   后端地址: http://47.123.26.25:8000
   支持WebSocket: 是
   HTTPS证书: 绑定您的SSL证书
   ```

3. **修改环境变量**
   ```env
   VITE_SUPABASE_URL=https://your-api-gateway-domain/supabase
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
