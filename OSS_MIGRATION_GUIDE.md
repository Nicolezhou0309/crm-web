# OSS 迁移指南

## 📋 迁移概述

本指南详细说明了如何将图片上传功能从 Supabase Storage 迁移到阿里云 OSS。

## ✅ 迁移状态

- ✅ 单图片上传测试通过
- ✅ 多图片上传测试通过
- ✅ 集成测试全部通过

## 🔧 OSS配置信息

```typescript
const ossConfig = {
  region: process.env.OSS_REGION || 'cn-shanghai',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET || 'vlinker-crm',
  endpoint: process.env.OSS_ENDPOINT || 'https://oss-cn-shanghai.aliyuncs.com',
  secure: true,
  timeout: 60000
};
```

## 📝 使用方法

### 1. 基本用法

```typescript
import { uploadToOSS } from '@/utils/ossUploadUtils';

// 上传单个文件
const result = await uploadToOSS(file, 'avatars/');
console.log('上传成功:', result.url);
```

### 2. 多文件上传

```typescript
import { uploadMultipleToOSS } from '@/utils/ossUploadUtils';

const files = [file1, file2, file3];
const results = await uploadMultipleToOSS(files, 'images/');
console.log('批量上传结果:', results);
```

## 🔐 环境变量配置

在 `.env` 文件中添加以下环境变量：

```bash
# 阿里云 OSS 配置
VITE_OSS_REGION=cn-shanghai
VITE_OSS_ACCESS_KEY_ID=your_access_key_id
VITE_OSS_ACCESS_KEY_SECRET=your_access_key_secret
VITE_OSS_BUCKET=vlinker-crm
VITE_OSS_ENDPOINT=https://oss-cn-shanghai.aliyuncs.com
```

## 🚀 部署说明

1. 确保环境变量已正确配置
2. 重新构建项目
3. 部署到生产环境

## 📊 性能对比

| 指标 | Supabase Storage | 阿里云 OSS |
|------|------------------|------------|
| 上传速度 | 中等 | 快速 |
| 存储成本 | 较高 | 较低 |
| CDN 加速 | 有限 | 优秀 |
| 稳定性 | 良好 | 优秀 |

## 🔧 故障排除

### 常见问题

1. **上传失败**
   - 检查 AccessKey 是否正确
   - 确认 Bucket 权限设置
   - 验证网络连接

2. **跨域问题**
   - 检查 OSS Bucket 的 CORS 设置
   - 确认域名白名单配置

3. **文件大小限制**
   - 默认限制为 10MB
   - 可在配置中调整 `maxFileSize`

## 📞 技术支持

如有问题，请联系开发团队或查看阿里云 OSS 官方文档。
