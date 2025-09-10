# 后端构建压缩包信息

## 📦 压缩包详情

**文件名**: `crm-web-backend-20250908-182312.tar.gz`  
**大小**: 68.9 KB  
**创建时间**: 2025年9月8日 18:23:12  
**位置**: `/Users/nichole/crm-web/`

## 📋 包含文件

压缩包包含以下文件：

### 核心文件
- `server.js` - 主服务器文件（已修复企业微信登录问题）
- `package.json` - 项目依赖配置
- `package-lock.json` - 依赖版本锁定文件

### 部署脚本
- `quick-deploy.sh` - 快速部署脚本
- `deploy-fix.sh` - 部署修复脚本
- `pm2-deployment-check.sh` - PM2 部署检查脚本

### 配置文件
- `env.example` - 环境变量示例文件
- `.env` - 当前环境配置
- `.env.backup` - 环境配置备份
- `.env.backup.20250908_143410` - 历史环境配置备份

### 文档
- `README.md` - 项目说明文档
- `DEPLOYMENT_GUIDE.md` - 部署指南
- `ALIYUN_DEPLOYMENT_GUIDE.md` - 阿里云部署指南

### 备份文件
- `server.js.backup` - 服务器文件备份

## 🚀 部署说明

### 1. 解压压缩包
```bash
tar -xzf crm-web-backend-20250908-182312.tar.gz
cd crm-web-backend/
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
```bash
cp env.example .env
# 编辑 .env 文件，配置必要的环境变量
```

### 4. 启动服务
```bash
# 使用 PM2 启动
pm2 start server.js --name crm-wecom-api

# 或直接启动
node server.js
```

## ✅ 修复内容

此压缩包包含以下修复：
- ✅ 修复了企业微信登录中的常量重新赋值错误
- ✅ 优化了用户数据库操作流程
- ✅ 改进了错误处理机制

## 📝 注意事项

1. **不包含 node_modules**: 压缩包排除了 `node_modules` 目录，需要在目标服务器上运行 `npm install` 安装依赖
2. **环境配置**: 部署前请确保正确配置 `.env` 文件
3. **数据库连接**: 确保目标服务器可以访问 Supabase 数据库
4. **企业微信配置**: 确保企业微信应用配置正确

## 🔧 快速部署命令

```bash
# 解压并进入目录
tar -xzf crm-web-backend-20250908-182312.tar.gz && cd crm-web-backend

# 安装依赖
npm install

# 配置环境变量
cp env.example .env

# 启动服务
pm2 start server.js --name crm-wecom-api
```
