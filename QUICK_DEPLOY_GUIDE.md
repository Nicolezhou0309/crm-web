# 🚀 快速部署到阿里云OSS

## 方法1：使用API自动部署（推荐）

### 1. 准备阿里云AccessKey

1. 登录阿里云控制台
2. 访问：RAM访问控制 → 用户 → 创建AccessKey
3. 保存AccessKey ID和Secret

### 2. 运行配置向导

```bash
node setup-deployment.js
```

按提示输入：
- AccessKey ID
- AccessKey Secret  
- 存储桶名称（默认：crm-web-frontend）
- 区域（默认：oss-cn-shanghai）

### 3. 执行部署

```bash
./deploy.sh
```

或者直接运行：
```bash
node deploy-with-api.js
```

## 方法2：手动设置环境变量

```bash
# 设置环境变量
export ACCESS_KEY_ID=your_access_key_id
export ACCESS_KEY_SECRET=your_access_key_secret
export BUCKET_NAME=crm-web-frontend
export REGION=oss-cn-shanghai

# 运行部署
node deploy-with-api.js
```

## 方法3：使用阿里云CLI（如果已安装）

```bash
# 配置CLI
aliyun configure

# 运行部署脚本
./deploy-to-aliyun.sh
```

## 部署完成后

### 访问地址
```
http://your-bucket-name.oss-cn-shanghai.aliyuncs.com
```

### 后续配置建议

1. **绑定自定义域名**
   - 在OSS控制台 → 传输管理 → 域名管理
   - 添加您的域名

2. **配置HTTPS**
   - 申请SSL证书
   - 在CDN中配置HTTPS

3. **设置CDN加速**
   - 阿里云控制台 → CDN
   - 添加域名，源站选择OSS

4. **配置缓存策略**
   - 静态资源长期缓存
   - HTML文件短期缓存

## 故障排除

### 1. 权限问题
确保AccessKey有以下权限：
- `oss:PutObject`
- `oss:GetObject`
- `oss:DeleteObject`
- `oss:PutBucketWebsite`

### 2. 网络问题
- 检查网络连接
- 确认防火墙设置
- 尝试使用VPN

### 3. 存储桶问题
- 确保存储桶名称全局唯一
- 检查存储桶区域设置
- 确认存储桶权限配置

## 成本估算

### OSS存储费用
- 标准存储：0.12元/GB/月
- 请求费用：0.01元/万次

### CDN费用
- 流量费用：0.24元/GB
- 请求费用：0.15元/万次

### 小型CRM系统（月访问量10万PV）
- OSS费用：约2-5元/月
- CDN费用：约5-10元/月
- **总计：约7-15元/月**

## 优势

✅ **完美解决混合内容问题** - 与Supabase同在阿里云  
✅ **成本低廉** - 每月仅需几元  
✅ **性能优秀** - CDN加速，全国访问快速  
✅ **维护简单** - 几乎无需运维  
✅ **高可用性** - 阿里云基础设施保障  

## 技术支持

如果遇到问题，请检查：
1. 阿里云AccessKey权限
2. 网络连接状态
3. 存储桶配置
4. 文件上传日志

---

**🎉 部署完成后，您的CRM系统就可以通过阿里云OSS访问了！**
