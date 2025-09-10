# CRM Web 部署包说明

## 📦 构建包列表

### 前端包
- **文件名**: `crm-web-frontend-20250909-130000.tar.gz`
- **大小**: 1.8MB
- **内容**: 
  - 直接包含构建后的前端文件（无dist目录层级）
  - `index.html` - 主页面文件
  - `assets/` - 静态资源目录
  - `package.json` - 项目配置和依赖声明（必需）

### 后端包
- **文件名**: `crm-web-backend-direct-20250909-113903.tar.gz`
- **大小**: 2.9MB
- **内容**:
  - 直接包含后端文件（无backend目录层级）
  - 包含所有必要的Node.js依赖
  - `package.json` - 项目配置和依赖声明（必需）
  - 即开即用，解压后直接启动

## 🚀 部署步骤

### 前端部署

1. **解压前端包**
   ```bash
   tar -xzf crm-web-frontend-20250909-130000.tar.gz
   ```

2. **配置Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           root /var/www/crm-web;
           index index.html;
           try_files $uri $uri/ /index.html;
       }
   }
   ```

3. **部署到服务器**
   ```bash
   # 直接复制文件到Web服务器根目录（无需dist目录）
   cp -r ./* /var/www/crm-web/
   
   # 设置权限
   sudo chown -R nginx:nginx /var/www/crm-web/
   sudo chmod -R 755 /var/www/crm-web/
   ```

4. **验证部署**
   ```bash
   # 检查index.html是否存在
   ls -la /var/www/crm-web/index.html
   
   # 重启Nginx
   sudo systemctl restart nginx
   ```

### 后端部署

1. **解压后端包**
   ```bash
   tar -xzf crm-web-backend-direct-20250909-113903.tar.gz
   ```

2. **进入解压后的目录**
   ```bash
   cd crm-web-backend-direct-20250909-113903
   ```

3. **安装依赖（如果需要）**
   ```bash
   # 安装生产环境依赖
   npm install --production
   ```

4. **配置环境变量**
   ```bash
   
   # 编辑.env文件，设置必要的环境变量
   # 注意：只需要配置一个.env文件，无需区分开发和生产环境
   nano .env
   ```

5. **启动服务**
   ```bash
   # 使用PM2启动
   pm2 start server.js --name "crm-backend"
   
   # 或直接启动
   node server.js
   ```

## 🔧 环境变量配置

### 统一环境变量配置 (.env)

**重要说明**: 项目使用统一的环境变量配置，只需要一个 `.env` 文件，无需区分开发和生产环境。所有环境变量都在同一个文件中管理。
```env
# 服务配置
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# 企业微信配置
WECOM_CORP_ID=your_corp_id
WECOM_AGENT_ID=your_agent_id
WECOM_SECRET=your_secret
WECOM_REDIRECT_URI=https://your-domain.com/api/auth/wecom/callback

# Supabase配置
VITE_SUPABASE_URL=https://lead.vld.com.cn/supabase
VITE_SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NTU3ODU4NjcsImV4cCI6MTMyNjY0MjU4Njd9.YnpJt0nFCQ66CudiuxycZGU51mIw6Y6Z3qGXdMWau80
VITE_SUPABASE_JWT_SECRET=0aCHBB2b3AkW5QziRYw5T5p5yqYIdrD3N8QyocLX
```

## ⚙️ 构建偏好配置

### 前端构建偏好
- **构建工具**: Vite
- **输出目录**: `dist/`
- **打包方式**: 将dist目录内容直接打包到根目录
- **包含文件**: 
  - 构建后的静态文件（index.html在根目录）
  - `assets/` 静态资源目录
  - `package.json` - 项目元数据和依赖声明（必需）
- **优化设置**:
  - 代码分割和懒加载
  - 资源压缩和缓存
  - 静态资源优化

### 后端构建偏好
- **目录结构**: 直接包含后端文件（无嵌套目录）
- **包含内容**:
  - 所有源码文件
  - `node_modules/` 生产依赖
  - `package.json` - 项目元数据和依赖声明（必需）
  - 配置文件（`.env`, `env.example`）
  - **环境变量**: 统一使用 `.env` 文件，无需区分环境
  - 部署脚本
- **即开即用**: 解压后直接启动，无需额外配置

### 构建命令
```bash
# 前端构建
npm run build

# 后端打包（直接包含文件，包含package.json）
cd backend && tar -czf ../crm-web-backend-direct-$(date +%Y%m%d-%H%M%S).tar.gz . && cd ..

# 前端打包（将dist目录内容直接打包到根目录，包含package.json）
cd dist && tar -czf ../crm-web-frontend-$(date +%Y%m%d-%H%M%S).tar.gz . ../package.json && cd ..
```

### 为什么只保留package.json？

**package.json** 的作用：
- 项目元数据（名称、版本、描述等）
- 依赖声明和版本范围
- 脚本命令定义
- 项目配置信息

**不保留package-lock.json的原因**：
- 减少部署包大小
- 简化部署流程
- 允许npm根据package.json自动解析最新兼容版本
- 避免版本锁定过于严格导致的兼容性问题

## 📋 功能特性

### 前端特性
- ✅ React + TypeScript + Vite
- ✅ Ant Design UI组件库
- ✅ 企业微信扫码登录
- ✅ JWT令牌认证
- ✅ 响应式设计
- ✅ 代码分割和懒加载

### 后端特性
- ✅ Express.js + Node.js
- ✅ 企业微信API集成
- ✅ Supabase数据库集成
- ✅ JWT令牌生成和验证
- ✅ 用户管理和认证
- ✅ 长轮询实时通信

## 🔐 安全配置

1. **JWT密钥**: 使用环境变量管理
2. **CORS**: 配置允许的前端域名
3. **速率限制**: 防止API滥用
4. **Helmet**: 安全头设置

## 📊 性能优化

### 前端优化
- 代码分割和懒加载
- 资源压缩和缓存
- 图片优化
- 静态资源CDN

### 后端优化
- 生产环境依赖
- 内存管理
- 连接池配置
- 日志管理

## 🚨 注意事项

1. **环境变量**: 确保所有敏感信息通过环境变量配置，使用统一的 `.env` 文件
2. **环境配置**: 无需区分 `.env` 和 `.env.production`，所有环境使用同一个配置文件
3. **HTTPS**: 生产环境建议使用HTTPS
4. **数据库**: 确保Supabase实例可访问
5. **企业微信**: 确保企业微信应用配置正确
6. **监控**: 建议配置应用监控和日志
7. **依赖管理**: 确保 `package.json` 包含在部署包中
8. **版本管理**: 使用 `npm install` 根据package.json自动解析兼容版本

## 📞 支持

如有问题，请检查：
1. 环境变量配置（确保 `.env` 文件存在且配置正确）
2. 网络连接
3. 服务状态
4. 日志文件
5. package.json 文件是否存在
6. 依赖安装是否成功
7. 环境变量文件格式是否正确（使用统一的 `.env` 文件）

---

**构建时间**: 2025-09-09 13:00:00
**版本**: 1.0.0
**状态**: 生产就绪
**构建偏好**: 已记录并应用
**前端打包**: 直接包含dist目录内容，无嵌套层级
**依赖管理**: 只包含package.json，允许npm自动解析兼容版本