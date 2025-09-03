# CRM前端应用 - 函数计算版本

这是CRM前端应用的函数计算版本。

## 快速开始

```bash
# 安装依赖
npm install

# 部署到开发环境
npm run deploy:dev

# 部署到生产环境
npm run deploy:prod

# 测试
npm test
```

## 环境变量

在template.yml中配置环境变量：

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_ENV
- VITE_APP_VERSION

## 部署

使用Fun工具部署到阿里云函数计算：

```bash
fun deploy --use-ros
```
