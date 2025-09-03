# CRM前端应用 - Serverless CD 部署指南

## 🚀 快速部署

### 1. 构建项目

```bash
# 使用自动化构建脚本
./build-for-serverless-cd.sh
```

这个脚本会：
- 构建前端项目 (`npm run build`)
- 创建 `code` 目录（Serverless CD 要求的工作目录）
- 复制所有必要的文件到 `code` 目录
- 创建正确的 `package.json` 和测试文件

### 2. 部署到 Serverless CD

在 Serverless CD 平台中：

1. **选择项目**: 选择您的 `leadmanagement` 项目
2. **构建配置**: 
   - 工作目录: `/code` 或 `code`
   - 构建命令: `npm install && npm run build`
   - 启动命令: `node index.js`

3. **环境变量**:
   ```
   VITE_SUPABASE_URL=http://47.123.26.25:8000
   VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiIsInJlZiI6InNicC04b2gxOG0wM2hiYjA4N3RhIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTU0MjI4MjEsImV4cCI6MjA3MDk5ODgyMX0.TMNhVSwNgrJHxRKQnV-GVzX_EovIQ6EIg2vXdQEWRgE
   VITE_APP_ENV=production
   NODE_ENV=production
   ```

## 📁 项目结构

```
├── code/                      # Serverless CD 工作目录
│   ├── index.js              # 函数入口文件
│   ├── package.json          # 依赖配置
│   ├── dist/                 # 前端构建文件
│   └── test.js               # 测试文件
├── build-for-serverless-cd.sh # 构建脚本
├── serverless-cd.yml         # Serverless CD 配置
└── serverless.yml            # 备用配置
```

## 🔧 配置说明

### code/index.js
- 函数计算入口文件
- 处理HTTP请求
- 服务静态文件
- 提供API端点

### code/package.json
- 最小化依赖
- 包含必要的运行时配置
- 支持Node.js 18+

### 环境变量
- `VITE_SUPABASE_URL`: Supabase服务地址
- `VITE_SUPABASE_ANON_KEY`: Supabase匿名密钥
- `VITE_APP_ENV`: 应用环境
- `NODE_ENV`: Node.js环境

## 🌐 功能特性

- ✅ **静态文件服务**: 自动服务前端资源
- ✅ **API端点**: `/api/health`, `/api/config`
- ✅ **SPA路由**: 支持前端路由回退
- ✅ **CORS支持**: 跨域请求配置
- ✅ **环境变量**: 运行时配置管理
- ✅ **健康检查**: 服务状态监控

## 🐛 故障排除

### 1. 工作目录错误

如果遇到 `Invalid working directory: /kaniko/tmp/workspace/code` 错误：

1. 确保 `code` 目录存在
2. 运行 `./build-for-serverless-cd.sh` 重新构建
3. 检查 `code` 目录包含所有必要文件

### 2. 构建失败

```bash
# 清理并重新构建
rm -rf code dist node_modules
npm install
./build-for-serverless-cd.sh
```

### 3. 函数执行错误

检查 `code/index.js` 文件：
- 确保文件存在且可执行
- 检查环境变量配置
- 查看函数计算日志

## 📊 部署检查清单

- [ ] `code` 目录存在
- [ ] `code/index.js` 文件存在
- [ ] `code/package.json` 配置正确
- [ ] `code/dist/` 包含构建文件
- [ ] 环境变量配置正确
- [ ] 构建脚本执行成功

## 🎯 部署流程

1. **本地构建**: `./build-for-serverless-cd.sh`
2. **提交代码**: `git add . && git commit && git push`
3. **Serverless CD**: 在平台中触发部署
4. **验证部署**: 访问分配的URL
5. **测试功能**: 检查静态文件和API端点

## 📝 注意事项

1. **工作目录**: Serverless CD 要求 `code` 目录
2. **构建顺序**: 先构建前端，再复制到 `code` 目录
3. **环境变量**: 确保在平台中正确配置
4. **文件权限**: 确保所有文件有正确的权限
5. **依赖管理**: `code/package.json` 只包含运行时依赖

享受 Serverless CD 部署的便利吧！
