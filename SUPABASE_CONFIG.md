# Supabase 自建实例配置说明

## 环境变量配置

根据您提供的信息，已配置以下环境变量：

### 后端配置 (backend/.env)
```env
# Supabase 配置（自建实例）
VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80
# 注意：后端只需要 Service Role Key，不需要 Anon Key
```

### 前端配置 (.env.local)
```env
# Supabase 配置（自建实例）
VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
VITE_SUPABASE_ANON_KEY=your_anon_key_here  # 前端需要 Anon Key 用于用户认证
```

## 快速启动

### 方法1: 使用启动脚本
```bash
./start-with-supabase.sh
```

### 方法2: 手动启动
```bash
# 1. 设置环境变量
export VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
export VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80

# 2. 验证配置
node verify-supabase-config.js

# 3. 启动后端
cd backend
npm start

# 4. 启动前端（新终端）
npm run dev
```

## 验证配置

运行验证脚本检查 Supabase 连接：

```bash
node verify-supabase-config.js
```

## 获取 Anon Key（仅前端需要）

**后端不需要 Anon Key**，只需要 Service Role Key。

前端需要 Anon Key 用于用户认证：

1. 访问 Supabase 管理界面：https://lead-service.vld.com.cn/supabase
2. 进入 Settings > API
3. 复制 `anon` `public` key
4. 更新 `.env.local` 文件中的 `VITE_SUPABASE_ANON_KEY`

## 测试企业微信认证

```bash
node test-wecom-auth.js
```

## 注意事项

1. **网络连接**: 确保能够访问 `47.123.26.25:8000`
2. **防火墙**: 检查防火墙设置，确保端口 8000 可访问
3. **SSL证书**: 自建实例可能没有有效的SSL证书，使用 HTTP 协议
4. **Service Role权限**: 确保 Service Role Key 有足够的权限执行管理员操作

## 故障排除

### 连接失败
- 检查 Supabase 实例是否正在运行
- 验证 IP 地址和端口是否正确
- 检查网络连接

### 权限错误
- 验证 Service Role Key 是否正确
- 检查 Key 是否过期
- 确认实例配置正确

### 依赖问题
- 确保安装了 `@supabase/supabase-js`
- 运行 `npm install` 安装依赖
