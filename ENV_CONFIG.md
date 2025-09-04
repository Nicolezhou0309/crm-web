# 环境变量配置说明

## 问题解决

您遇到的混合内容错误是因为：
1. 页面通过HTTPS加载（`https://lead.vld.com.cn`）
2. 但尝试连接到不安全的WebSocket端点（`ws://47.123.26.25:8000`）
3. 浏览器安全策略阻止了这种混合内容连接

## 解决方案

### 1. 创建环境变量文件

在项目根目录创建 `.env` 文件：

```env
# Supabase 配置
VITE_SUPABASE_URL=https://lead-service.vld.com.cn
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg

# 应用配置
VITE_APP_ENV=production
VITE_APP_VERSION=1.0.0
```

### 2. 已修复的问题

✅ **硬编码URL问题**：
- 修复了 `OnboardingPage.tsx` 中的硬编码IP地址
- 现在使用环境变量 `${import.meta.env.VITE_SUPABASE_URL}`

✅ **Realtime服务优化**：
- 创建了统一的 `RealtimeService` 管理器
- 启用了所有realtime功能（代理服务器支持WebSocket）
- 删除了不再需要的轮询替代方案
- 恢复了 `LiveStreamRegistrationBase.tsx` 中的realtime功能

✅ **环境变量配置**：
- 所有URL现在都使用环境变量
- 代理服务器支持WebSocket，已启用realtime功能
- 移除了HTTPS/HTTP分支逻辑

### 3. 配置说明

- `VITE_SUPABASE_URL`: 您的HTTPS Supabase服务地址
- `VITE_SUPABASE_ANON_KEY`: 匿名访问密钥
- `VITE_SUPABASE_SERVICE_ROLE_KEY`: 服务角色密钥（用于审批等操作）

### 4. 部署注意事项

1. **确保HTTPS代理配置正确**：
   - 您的 `https://lead-service.vld.com.cn` 应该正确代理到后端服务
   - 支持WebSocket升级（如果需要realtime功能）

2. **Realtime功能**：
   - 代理服务器支持WebSocket，已启用realtime功能
   - 提供实时数据同步，性能优于轮询
   - 支持实时通知、并发控制等功能
   - 避免了混合内容问题
   - 已删除轮询替代方案，统一使用realtime

### 5. 验证修复

重新构建和部署后，检查：
1. 浏览器控制台不再有混合内容错误
2. 应用功能正常工作
3. 数据更新通过轮询方式实现

## 技术细节

### 混合内容错误原因
```
Mixed Content: The page at 'https://lead.vld.com.cn/live-stream-registration' 
was loaded over HTTPS, but attempted to connect to the insecure WebSocket 
endpoint 'ws://47.123.26.25:8000/realtime/v1/websocket'
```

### 解决方案
1. 使用HTTPS URL替代HTTP URL
2. 禁用不安全的WebSocket连接
3. 使用轮询方式替代realtime功能
4. 统一管理所有realtime相关代码
