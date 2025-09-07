# 企业微信API服务部署包

## 📋 更新内容

### 修复的问题
1. **授权链接域名**: 从 `open.work.weixin.qq.com` 修复为 `open.weixin.qq.com`
2. **授权Scope**: 从 `snsapi_privateinfo` 修改为 `snsapi_base` (静默授权)
3. **符合企业微信官方文档标准**

### 文件清单
- `server.js` - 主服务文件 (已更新)
- `package.json` - 依赖配置
- `.env` - 环境变量配置
- `aliyun-existing-env-deploy.sh` - 部署脚本
- `README.md` - 说明文档

## 🚀 部署步骤

### 1. 上传到服务器
```bash
scp crm-wecom-api-fixed-$(date +%Y%m%d-%H%M%S).tar.gz root@8.159.132.181:/opt/
```

### 2. 解压并部署
```bash
cd /opt
tar -xzf crm-wecom-api-fixed-*.tar.gz
cd crm-wecom-api
chmod +x aliyun-existing-env-deploy.sh
./aliyun-existing-env-deploy.sh
```

### 3. 验证部署
```bash
# 检查服务状态
pm2 status

# 测试API
curl https://lead-service.vld.com.cn/api/health
curl https://lead-service.vld.com.cn/api/auth/wecom/qrcode
```

## ✅ 预期结果

部署成功后，API应该返回正确的授权链接格式：
```json
{
  "success": true,
  "data": {
    "authUrl": "https://open.weixin.qq.com/connect/oauth2/authorize?appid=ww68a125fce698cb59&redirect_uri=https%3A%2F%2Flead-service.vld.com.cn%2Fauth%2Fwecom%2Fcallback&response_type=code&scope=snsapi_base&state=qrcode_xxx&agentid=1000002#wechat_redirect",
    "state": "qrcode_xxx"
  }
}
```

---
构建时间: $(date)
构建原因: 修复企业微信OAuth2.0授权链接格式问题
