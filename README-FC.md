# CRM前端应用 - 函数计算版本

## 🎯 项目概述

这是CRM前端应用的函数计算版本，基于Vite + React + TypeScript构建，部署在阿里云函数计算平台上。

## 🏗️ 架构特点

### ✅ 技术栈
- **前端**: Vite + React + TypeScript
- **UI库**: Ant Design + Tailwind CSS
- **后端**: Supabase (PostgreSQL + Auth)
- **部署**: 阿里云函数计算
- **构建**: Vite (支持ES模块)

### 🚀 函数计算优势
- **环境变量管理** - 无需重新构建，直接在控制台修改
- **调试便利** - 可以查看函数执行日志，快速定位问题
- **按量计费** - 只为实际使用付费
- **自动扩展** - 根据请求量自动调整
- **高可用** - 阿里云基础设施保障

## 📁 项目结构

```
crm-fc-app/
├── package.json              # 函数计算项目配置
├── index.js                  # 函数入口文件
├── template.yml              # 函数计算配置（生产环境）
├── template-dev.yml          # 函数计算配置（开发环境）
├── template-prod.yml         # 函数计算配置（生产环境）
├── fc-deploy.sh              # 部署脚本
├── fc-test.js                # 测试脚本
├── dist/                     # Vite构建文件
│   ├── index.html
│   ├── assets/
│   └── ...
└── node_modules/             # 依赖包
```

## 🚀 快速开始

### 1. 环境准备

```bash
# 安装阿里云CLI
curl -fsSL https://aliyuncli.alicdn.com/aliyun-cli-macosx-latest-amd64.tgz | tar -xzC ~/bin && chmod +x ~/bin/aliyun

# 安装Fun工具
npm install -g @alicloud/fun

# 配置阿里云凭证
aliyun configure
fun config
```

### 2. 构建前端项目

```bash
# 安装依赖
npm install

# 构建项目
npm run build
```

### 3. 部署到函数计算

```bash
# 部署到开发环境
./fc-deploy.sh dev

# 部署到生产环境
./fc-deploy.sh prod
```

### 4. 测试部署

```bash
# 运行测试
node fc-test.js
```

## 🔧 配置说明

### 环境变量

函数计算中的环境变量配置：

```yaml
EnvironmentVariables:
  VITE_SUPABASE_URL: 'http://47.123.26.25:8000'
  VITE_SUPABASE_ANON_KEY: 'your-anon-key'
  VITE_SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key'
  VITE_APP_ENV: 'production'
  VITE_APP_VERSION: '1.0.0'
  VITE_WECOM_CORP_ID: 'your-corp-id'
  VITE_WECOM_AGENT_ID: 'your-agent-id'
  NODE_ENV: 'production'
```

### 函数配置

- **运行时**: Node.js 18
- **内存**: 1024MB (生产环境), 512MB (开发环境)
- **超时**: 60秒 (生产环境), 30秒 (开发环境)
- **并发**: 10 (生产环境), 5 (开发环境)

## 📱 API端点

### 配置端点
- `GET /api/config` - 获取应用配置
- `GET /api/health` - 健康检查

### 静态文件
- 所有其他请求返回 `index.html` (SPA路由支持)

## 🔄 部署流程

### 开发环境部署
```bash
# 1. 构建前端
npm run build

# 2. 部署到开发环境
./fc-deploy.sh dev

# 3. 测试功能
node fc-test.js
```

### 生产环境部署
```bash
# 1. 构建前端
npm run build

# 2. 部署到生产环境
./fc-deploy.sh prod

# 3. 验证部署
# 访问函数计算控制台获取访问地址
```

## 🛠️ 开发指南

### 本地开发

```bash
# 启动本地开发服务器
npm run dev

# 访问 http://localhost:3000
```

### 调试

```bash
# 查看函数日志
fun logs

# 查看实时日志
fun logs --tail

# 本地测试
node fc-test.js
```

### 环境变量管理

1. **开发环境**: 在 `template-dev.yml` 中修改
2. **生产环境**: 在 `template-prod.yml` 中修改
3. **运行时修改**: 在阿里云控制台修改

## 📊 监控和日志

### 日志查看
- 阿里云控制台 → 函数计算 → 日志
- 使用 `fun logs` 命令查看

### 性能监控
- 函数调用次数
- 响应时间
- 错误率
- 内存使用情况

## 🔒 安全配置

### CORS设置
```yaml
Cors:
  AllowOrigin: '*'
  AllowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH']
  AllowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Client-Info']
```

### 安全中间件
- Helmet.js - 安全头设置
- CORS - 跨域请求控制
- 请求大小限制 - 防止DoS攻击

## 🚨 故障排除

### 常见问题

1. **部署失败**
   - 检查阿里云凭证配置
   - 确认函数计算权限
   - 查看构建文件是否完整

2. **环境变量不生效**
   - 检查模板文件配置
   - 确认环境变量名称正确
   - 重新部署函数

3. **静态文件无法访问**
   - 检查dist目录是否复制
   - 确认文件路径正确
   - 查看函数日志

### 调试步骤

1. 查看函数执行日志
2. 检查环境变量配置
3. 验证构建文件完整性
4. 测试API端点响应

## 📈 性能优化

### 缓存策略
- HTML文件: 不缓存
- JS/CSS文件: 长期缓存 (1年)
- JSON文件: 中等缓存 (1小时)

### 压缩优化
- Gzip压缩
- 静态资源压缩
- 代码分割

## 🔄 更新流程

### 代码更新
```bash
# 1. 修改代码
# 2. 重新构建
npm run build

# 3. 重新部署
./fc-deploy.sh prod
```

### 配置更新
```bash
# 1. 修改模板文件
# 2. 重新部署
./fc-deploy.sh prod
```

## 📞 技术支持

如果遇到问题：
1. 查看函数执行日志
2. 检查环境变量配置
3. 验证构建文件完整性
4. 联系技术支持

---

## 🎉 部署完成

恭喜！您的CRM系统已成功部署到阿里云函数计算。现在可以：

- ✅ 灵活管理环境变量
- ✅ 方便调试和监控
- ✅ 按需付费
- ✅ 自动扩展
- ✅ 高可用性

享受函数计算带来的便利吧！
