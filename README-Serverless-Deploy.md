# CRM前端应用 - Serverless Devs 部署指南

## 🚀 快速部署

### 1. 安装 Serverless Devs

```bash
npm install -g @serverless-devs/s
```

### 2. 配置阿里云凭证

```bash
s config add
```

按提示输入：
- AccessKey ID: `你的AccessKey ID`
- AccessKey Secret: `你的AccessKey Secret`
- 默认区域: `cn-shanghai`

### 3. 构建并部署

```bash
# 使用自动化脚本
./deploy-serverless.sh

# 或手动执行
npm install
npm run build
cp -r dist/* fc-app/dist/
s deploy
```

## 📁 项目结构

```
├── s.yaml                    # Serverless Devs 配置文件
├── deploy-serverless.sh      # 自动化部署脚本
├── fc-app/                   # 函数计算应用目录
│   ├── index.js             # 函数入口文件
│   ├── package.json         # 函数依赖
│   ├── dist/                # 构建后的前端文件
│   └── template.yml         # 函数计算模板
├── src/                     # 前端源码
└── dist/                    # 构建输出
```

## 🔧 配置说明

### s.yaml 配置

- **服务名称**: `crm-frontend`
- **函数名称**: `crm-frontend-app`
- **运行时**: Node.js 18
- **内存**: 1024MB
- **超时**: 60秒
- **区域**: cn-shanghai

### 环境变量

- `VITE_SUPABASE_URL`: Supabase服务地址
- `VITE_SUPABASE_ANON_KEY`: Supabase匿名密钥
- `VITE_APP_ENV`: 应用环境 (production)
- `NODE_ENV`: Node.js环境

## 🌐 访问地址

部署完成后，您将获得：

- **HTTP触发器**: 自动分配的访问地址
- **API端点**: 
  - `/api/health` - 健康检查
  - `/api/config` - 配置信息
- **静态文件**: 自动服务前端资源

## 📊 管理命令

```bash
# 查看部署信息
s info

# 查看函数日志
s logs -f

# 重新部署
s deploy

# 删除服务
s remove
```

## 🐛 故障排除

### 1. 工作目录错误

如果遇到 `Invalid working directory` 错误：

1. 确保 `s.yaml` 文件在项目根目录
2. 检查 `codeUri: ./fc-app` 路径是否正确
3. 确保 `fc-app` 目录存在且包含必要文件

### 2. 构建失败

```bash
# 清理并重新构建
rm -rf node_modules dist
npm install
npm run build
```

### 3. 权限问题

```bash
# 确保脚本有执行权限
chmod +x deploy-serverless.sh
```

## 📝 注意事项

1. **首次部署**: 可能需要等待几分钟创建服务
2. **环境变量**: 确保 Supabase 配置正确
3. **CORS**: 已配置允许所有来源访问
4. **静态文件**: 自动服务 `dist` 目录中的文件
5. **SPA路由**: 支持前端路由回退到 `index.html`

## 🎯 特性

- ✅ **自动构建**: 集成前端构建流程
- ✅ **环境变量**: 运行时配置管理
- ✅ **静态服务**: 自动服务前端资源
- ✅ **API支持**: 健康检查和配置端点
- ✅ **CORS配置**: 跨域请求支持
- ✅ **SPA路由**: 单页应用路由支持
- ✅ **日志监控**: 完整的日志记录

享受 Serverless 部署的便利吧！
