# CRM Web 前端部署包

## 部署包内容

- 构建后的 React 应用文件
- 静态资源文件（CSS、JS、图片等）
- 优化后的生产版本

## 部署说明

### 1. 解压文件
```bash
tar -xzf crm-web-frontend-*.tar.gz
```

### 2. 部署到静态服务器

#### Nginx 部署
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/frontend/files;
    index index.html;
    
    # 处理 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Apache 部署
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/frontend/files
    
    # 处理 SPA 路由
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

### 3. 环境变量配置

确保前端能够访问正确的后端 API：

- `VITE_API_BASE_URL` - 后端 API 地址
- `VITE_SUPABASE_URL` - Supabase 实例地址
- `VITE_SUPABASE_ANON_KEY` - Supabase 匿名密钥

### 4. 验证部署

1. 访问前端应用
2. 测试企业微信登录功能
3. 检查控制台是否有错误

## 重要更新

### 企业微信登录修复

本次前端部署包含了以下修复：

- ✅ 简化 WecomAuthManager，直接处理 JWT 令牌
- ✅ 移除 signup 链接处理逻辑
- ✅ 优化认证流程，减少用户操作步骤

## 文件结构

```
├── index.html              # 主页面
├── assets/                 # 静态资源
│   ├── css/               # 样式文件
│   ├── js/                # JavaScript 文件
│   └── worker-*.js        # Web Worker 文件
├── fonts/                  # 字体文件
├── *.svg                   # 图标文件
└── *.json                  # 数据文件
```

## 故障排除

如果遇到问题：

1. 检查浏览器控制台错误
2. 验证后端 API 连接
3. 确认环境变量配置
4. 检查网络连接

## 联系支持

如有问题，请检查：
- 浏览器控制台错误
- 网络请求状态
- 后端服务状态