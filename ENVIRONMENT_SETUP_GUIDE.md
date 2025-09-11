# 环境文件设置指南

## 📁 在 /opt/crm-wecom-api 目录中设置环境文件

### 方法1: 使用命令行创建

```bash
# 1. 进入目标目录
cd /opt/crm-wecom-api

# 2. 创建环境文件
sudo touch .env

# 3. 设置文件权限（确保只有root和crm-wecom-api用户可读写）
sudo chown crm-wecom-api:crm-wecom-api .env
sudo chmod 600 .env

# 4. 编辑环境文件
sudo nano .env
# 或使用其他编辑器
sudo vim .env
```

### 方法2: 使用文件传输

```bash
# 1. 从本地复制环境文件模板
scp env.example user@server:/opt/crm-wecom-api/.env

# 2. 在服务器上设置权限
ssh user@server
sudo chown crm-wecom-api:crm-wecom-api /opt/crm-wecom-api/.env
sudo chmod 600 /opt/crm-wecom-api/.env
```

### 方法3: 使用部署脚本

```bash
# 创建部署脚本
cat > setup-env.sh << 'EOF'
#!/bin/bash

# 设置目录
TARGET_DIR="/opt/crm-wecom-api"
ENV_FILE="$TARGET_DIR/.env"

# 检查目录是否存在
if [ ! -d "$TARGET_DIR" ]; then
    echo "创建目录: $TARGET_DIR"
    sudo mkdir -p "$TARGET_DIR"
fi

# 创建环境文件
if [ ! -f "$ENV_FILE" ]; then
    echo "创建环境文件: $ENV_FILE"
    sudo touch "$ENV_FILE"
fi

# 设置权限
sudo chown crm-wecom-api:crm-wecom-api "$ENV_FILE"
sudo chmod 600 "$ENV_FILE"

echo "环境文件已创建: $ENV_FILE"
echo "请编辑文件内容: sudo nano $ENV_FILE"
EOF

# 运行脚本
chmod +x setup-env.sh
sudo ./setup-env.sh
```

## 📝 环境文件内容模板

```env
# 企业微信登录API服务环境变量配置

# 服务器配置
PORT=3001
NODE_ENV=production

# 前端地址（用于CORS配置）
FRONTEND_URL=https://lead.vld.com.cn

# 企业微信配置
WECOM_CORP_ID=ww68a125fce698cb59
WECOM_AGENT_ID=1000002
WECOM_SECRET=sXQeFCLDQJkwrX5lMWDzBTEIiHK1J7-a2e7chPyqYxY
WECOM_REDIRECT_URI=https://lead.vld.com.cn/auth/wecom/callback

# Supabase 配置（自建实例）
VITE_SUPABASE_URL=https://lead-service.vld.com.cn/supabase
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80

# JWT 配置
VITE_SUPABASE_JWT_SECRET=0aCHBB2b3AkW5QziRYw5T5p5yqYIdrD3N8QyocLX
```

## 🔐 权限设置

### 推荐权限配置
```bash
# 设置文件所有者
sudo chown crm-wecom-api:crm-wecom-api /opt/crm-wecom-api/.env

# 设置文件权限（只有所有者可读写）
sudo chmod 600 /opt/crm-wecom-api/.env

# 设置目录权限
sudo chmod 755 /opt/crm-wecom-api
```

### 验证权限
```bash
# 检查文件权限
ls -la /opt/crm-wecom-api/.env

# 应该显示类似：
# -rw------- 1 crm-wecom-api crm-wecom-api 1234 Sep  9 12:00 .env
```

## 🚀 部署后验证

### 1. 检查环境文件
```bash
# 检查文件是否存在
ls -la /opt/crm-wecom-api/.env

# 检查文件内容（只读）
cat /opt/crm-wecom-api/.env
```

### 2. 测试环境变量加载
```bash
# 进入项目目录
cd /opt/crm-wecom-api

# 测试环境变量加载
node -e "require('dotenv').config(); console.log('JWT Secret:', process.env.VITE_SUPABASE_JWT_SECRET ? '已配置' : '未配置');"
```

### 3. 启动服务测试
```bash
# 启动服务
cd /opt/crm-wecom-api
pm2 start server.js --name "crm-wecom-api"

# 检查服务状态
pm2 status

# 查看日志
pm2 logs crm-wecom-api
```

## ⚠️ 安全注意事项

1. **文件权限**: 确保 `.env` 文件只有必要用户可访问
2. **敏感信息**: 不要在日志中输出敏感信息
3. **备份**: 定期备份环境配置文件
4. **版本控制**: 不要将 `.env` 文件提交到版本控制系统

## 🔧 故障排除

### 常见问题

1. **权限不足**
   ```bash
   # 错误: Permission denied
   # 解决: 使用 sudo 或检查文件权限
   sudo chown crm-wecom-api:crm-wecom-api /opt/crm-wecom-api/.env
   ```

2. **环境变量未加载**
   ```bash
   # 检查文件路径
   pwd
   ls -la .env
   
   # 检查文件内容
   cat .env
   ```

3. **服务启动失败**
   ```bash
   # 查看详细错误
   pm2 logs crm-wecom-api --lines 50
   
   # 检查环境变量
   node -e "require('dotenv').config(); console.log(process.env);"
   ```

---

**创建时间**: 2025-09-09 12:00:00
**适用版本**: 1.0.0
**状态**: 生产就绪
