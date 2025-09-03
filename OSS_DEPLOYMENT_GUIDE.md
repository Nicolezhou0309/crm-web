# 阿里云 OSS 部署指南

## 🎯 问题解决状态

✅ **Supabase 配置已修复**
- 环境变量已正确注入到构建文件中
- Supabase URL: `http://47.123.26.25:8000`
- Anon Key 已正确配置

## 📋 部署步骤

### 1. 本地构建验证

```bash
# 构建项目（使用生产环境配置）
npm run build

# 验证配置
./verify-oss-config.sh
```

### 2. 上传到阿里云 OSS

#### 方法1：使用阿里云控制台（推荐）

1. **登录阿里云控制台**
   - 访问：https://oss.console.aliyun.com/
   - 选择您的存储桶

2. **上传文件**
   - 进入存储桶 → 文件管理
   - 上传整个 `dist` 文件夹的内容
   - 确保 `index.html` 在根目录

3. **配置静态网站托管**
   - 存储桶 → 基础设置 → 静态页面
   - 默认首页：`index.html`
   - 默认404页：`index.html`（支持SPA路由）

#### 方法2：使用阿里云CLI

```bash
# 安装阿里云CLI
npm install -g @alicloud/cli

# 配置凭证
aliyun configure

# 上传文件
aliyun oss cp dist/ oss://your-bucket-name/ --recursive --force

# 配置静态网站托管
aliyun oss website oss://your-bucket-name/ \
  --index-document index.html \
  --error-document index.html
```

### 3. 配置域名和CDN（可选）

#### 绑定自定义域名
1. **域名解析**
   - 在域名控制台添加CNAME记录
   - 记录值：`your-bucket.oss-cn-shanghai.aliyuncs.com`

2. **OSS绑定域名**
   - 存储桶 → 传输管理 → 域名管理
   - 绑定您的自定义域名

#### 配置CDN加速
1. **创建CDN加速域名**
   - CDN控制台 → 域名管理 → 添加域名
   - 源站类型：OSS域名
   - 源站域名：选择您的OSS存储桶

2. **配置HTTPS（可选）**
   - 申请免费SSL证书
   - 在CDN中配置HTTPS

## 🔧 配置验证

### 检查清单

- [ ] ✅ 环境变量已正确注入
- [ ] ✅ Supabase URL 配置正确
- [ ] ✅ Anon Key 配置正确
- [ ] ✅ 静态网站托管已启用
- [ ] ✅ SPA路由支持已配置
- [ ] ✅ 文件上传完成

### 测试步骤

1. **访问应用**
   ```
   http://your-bucket.oss-cn-shanghai.aliyuncs.com
   ```

2. **测试登录功能**
   - 尝试使用邮箱密码登录
   - 检查是否还有认证错误

3. **检查网络请求**
   - 打开浏览器开发者工具
   - 查看Network标签页
   - 确认请求地址为：`http://47.123.26.25:8000`

## 🚨 故障排除

### 常见问题

#### 1. 认证错误仍然存在
**解决方案：**
- 清除浏览器缓存
- 检查OSS存储桶的CORS设置
- 确认环境变量在构建时正确注入

#### 2. 页面无法访问
**解决方案：**
- 检查静态网站托管是否启用
- 确认index.html在根目录
- 检查存储桶的读写权限

#### 3. SPA路由不工作
**解决方案：**
- 确认404页面设置为index.html
- 检查.htaccess或nginx配置

### CORS配置

如果遇到CORS问题，在OSS控制台配置：

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-oss-request-id"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

## 📊 性能优化

### 1. 启用CDN
- 配置CDN加速域名
- 设置缓存策略
- 启用Gzip压缩

### 2. 文件压缩
- 构建时已启用代码分割
- 静态资源已压缩
- 图片资源可进一步优化

### 3. 缓存策略
- 设置合适的缓存头
- 配置版本控制
- 启用浏览器缓存

## 🔄 自动化部署

### GitHub Actions 工作流

```yaml
name: Deploy to Aliyun OSS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build
      run: npm run build
      
    - name: Deploy to OSS
      uses: fangbinwei/aliyun-oss-website-action@v1
      with:
        accessKeyId: ${{ secrets.ACCESS_KEY_ID }}
        accessKeySecret: ${{ secrets.ACCESS_KEY_SECRET }}
        bucket: your-bucket-name
        endpoint: oss-cn-shanghai.aliyuncs.com
        folder: dist
```

## 📞 技术支持

如果遇到问题，请检查：

1. **环境变量配置**
   - 确认 `.env.production` 文件存在
   - 验证环境变量值正确

2. **构建配置**
   - 运行 `npm run build` 确认构建成功
   - 使用 `./verify-oss-config.sh` 验证配置

3. **OSS配置**
   - 确认静态网站托管已启用
   - 检查文件上传是否完整

4. **网络连接**
   - 测试Supabase服务器连通性
   - 检查防火墙设置

---

## 🎉 部署完成

恭喜！您的CRM系统已成功部署到阿里云OSS。现在可以：

- ✅ 正常使用登录功能
- ✅ 访问所有业务功能
- ✅ 享受阿里云的高性能服务
- ✅ 避免混合内容问题

如有任何问题，请参考故障排除部分或联系技术支持。
