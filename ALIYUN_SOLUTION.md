# 阿里云环境混合内容解决方案

## 环境说明
- **数据库**：阿里云Supabase实例 (47.123.26.25:8000)
- **前端**：阿里云函数计算服务
- **域名**：lead.vld.com.cn (HTTPS)

## 推荐方案：阿里云API网关 + 函数计算

### 方案1：使用API网关代理（推荐）

#### 1.1 创建API网关服务

1. **登录阿里云控制台**
   - 进入API网关服务
   - 创建API分组

2. **配置API网关**
   ```yaml
   # API配置示例
   API名称: supabase-proxy
   请求路径: /supabase/*
   后端服务地址: 172.29.115.115:8000
   请求方法: ALL
   ```

3. **配置HTTPS证书**
   - 绑定您的SSL证书到API网关
   - 确保支持WebSocket升级

#### 1.2 修改应用配置

在函数计算环境中设置环境变量：
```env
VITE_SUPABASE_URL=https://your-api-gateway-domain/supabase
```

### 方案2：使用阿里云CDN + 源站配置

#### 2.1 配置CDN

1. **创建CDN加速域名**
   - 源站类型：IP
   - 源站地址：47.123.26.25:8000
   - 加速区域：仅中国内地

2. **配置HTTPS**
   - 上传SSL证书
   - 开启HTTPS加速

3. **配置回源协议**
   - 回源协议：HTTP
   - 回源端口：8000

#### 2.2 修改应用配置

```env
VITE_SUPABASE_URL=https://your-cdn-domain
```

### 方案3：使用阿里云SLB（服务器负载均衡）

#### 3.1 配置SLB

1. **创建负载均衡实例**
   - 实例类型：应用型负载均衡ALB
   - 网络类型：公网

2. **配置监听器**
   ```yaml
   监听协议: HTTPS
   监听端口: 443
   后端协议: HTTP
   后端端口: 8000
   后端服务器: 47.123.26.25
   ```

3. **配置SSL证书**
   - 上传您的SSL证书
   - 绑定到HTTPS监听器

#### 3.2 修改应用配置

```env
VITE_SUPABASE_URL=https://your-slb-domain
```

### 方案4：函数计算直接代理（最简单）

#### 4.1 创建代理函数

在您的函数计算服务中创建一个代理函数：

```javascript
// 代理函数代码
exports.handler = async (event, context) => {
  const { httpMethod, path, headers, body } = event;
  
  // 构建目标URL
  const targetUrl = `172.29.115.115:8000${path}`;
  
  // 转发请求
  const response = await fetch(targetUrl, {
    method: httpMethod,
    headers: {
      ...headers,
      'host': '47.123.26.25:8000'
    },
    body: body
  });
  
  return {
    statusCode: response.status,
    headers: response.headers,
    body: await response.text()
  };
};
```

#### 4.2 配置函数计算

1. **创建函数**
   - 函数名称：supabase-proxy
   - 运行时：Node.js 18
   - 触发器：HTTP触发器

2. **配置域名**
   - 绑定自定义域名：supabase.lead.vld.com.cn
   - 配置HTTPS证书

#### 4.3 修改应用配置

```env
VITE_SUPABASE_URL=https://supabase.lead.vld.com.cn
```

## 推荐实施步骤

### 第一步：选择方案
**推荐使用方案4（函数计算代理）**，因为：
- 最简单，不需要额外服务
- 成本最低
- 完全控制代理逻辑
- 易于调试和维护

### 第二步：实施代理函数

1. **创建代理函数**
   ```bash
   # 在函数计算控制台创建新函数
   函数名称: supabase-proxy
   运行时: Node.js 18
   入口函数: index.handler
   ```

2. **部署代理代码**
   ```javascript
   const https = require('https');
   const http = require('http');
   
   exports.handler = async (event, context) => {
     const { httpMethod, path, headers, body } = event;
     
     return new Promise((resolve) => {
       const options = {
         hostname: '47.123.26.25',
         port: 8000,
         path: path,
         method: httpMethod,
         headers: {
           ...headers,
           'host': '47.123.26.25:8000'
         }
       };
       
       const req = http.request(options, (res) => {
         let data = '';
         res.on('data', (chunk) => data += chunk);
         res.on('end', () => {
           resolve({
             statusCode: res.statusCode,
             headers: res.headers,
             body: data
           });
         });
       });
       
       req.on('error', (error) => {
         resolve({
           statusCode: 500,
           body: JSON.stringify({ error: error.message })
         });
       });
       
       if (body) {
         req.write(body);
       }
       req.end();
     });
   };
   ```

### 第三步：配置域名和证书

1. **绑定自定义域名**
   - 域名：supabase.lead.vld.com.cn
   - 路径：/*
   - 函数：supabase-proxy

2. **配置HTTPS证书**
   - 上传SSL证书
   - 启用HTTPS

### 第四步：更新应用配置

```env
VITE_SUPABASE_URL=https://supabase.lead.vld.com.cn
```

## 验证方法

```javascript
// 测试API连接
fetch('https://supabase.lead.vld.com.cn/auth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ grant_type: 'password' })
})
.then(response => console.log('API连接成功:', response))
.catch(error => console.error('API连接失败:', error));

// 测试WebSocket连接
const ws = new WebSocket('wss://supabase.lead.vld.com.cn/realtime/v1/websocket');
ws.onopen = () => console.log('WebSocket连接成功');
ws.onerror = (error) => console.error('WebSocket连接失败:', error);
```

## 成本估算

- **方案1（API网关）**：按调用次数收费，约0.01元/万次
- **方案2（CDN）**：按流量收费，约0.24元/GB
- **方案3（SLB）**：按实例收费，约18元/月
- **方案4（函数计算）**：按调用次数收费，约0.0133元/万次

**推荐方案4，成本最低且最灵活。**

## 注意事项

1. **WebSocket支持**：确保代理支持WebSocket升级
2. **超时设置**：配置合适的超时时间
3. **错误处理**：添加完善的错误处理逻辑
4. **监控告警**：配置监控和告警
5. **缓存策略**：根据需要配置缓存
