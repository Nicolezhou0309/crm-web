# 前端阿里云Supabase配置指南

## 🎯 概述

本指南将帮助您将前端项目从本地Supabase切换到阿里云Supabase实例。

## 📋 项目信息

- **项目ID**: 1865238354801584
- **区域**: cn-shanghai (上海)
- **服务类型**: 阿里云Supabase

## 🚀 快速配置

### 1. 自动设置环境变量

```bash
# 运行自动配置脚本
./setup-aliyun-env.sh
```

### 2. 手动设置环境变量

创建或编辑 `.env` 文件：

```bash
# 前端环境变量 (Vite)
VITE_SUPABASE_URL=https://1865238354801584.cn-shanghai.fc.aliyuncs.com
VITE_SUPABASE_ANON_KEY=your_aliyun_supabase_anon_key_here
VITE_SUPABASE_SERVICE_ROLE_KEY=your_aliyun_supabase_service_role_key_here
VITE_USE_ALIYUN_SUPABASE=true

# 后端环境变量
SUPABASE_URL=https://1865238354801584.cn-shanghai.fc.aliyuncs.com
SUPABASE_ANON_KEY=your_aliyun_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_aliyun_supabase_service_role_key_here

# 阿里云配置
ALIYUN_REGION=cn-shanghai
ALIYUN_PROJECT_ID=1865238354801584
```

## 🔧 配置文件说明

### 主要配置文件

1. **`src/supaClient.ts`** - 原始Supabase客户端
2. **`src/supaClient.aliyun.ts`** - 阿里云Supabase专用客户端
3. **`src/supaClient.updated.ts`** - 支持配置切换的客户端
4. **`src/config/supabaseConfig.ts`** - 配置管理模块

### 配置切换

```typescript
// 使用配置切换器
import { getCurrentSupabaseConfig, getSupabaseConfigInfo } from './config/supabaseConfig';

// 获取当前配置
const config = getCurrentSupabaseConfig();
const info = getSupabaseConfigInfo();

console.log('当前使用:', info.isAliyun ? '阿里云Supabase' : '本地Supabase');
```

## 📱 前端集成

### 1. 替换Supabase客户端

```typescript
// 从
import { supabase } from './supaClient';

// 改为
import { supabase } from './supaClient.updated';
```

### 2. 检查连接状态

```typescript
import { checkConnection, getSupabaseInfo } from './supaClient.updated';

// 检查连接
const isConnected = await checkConnection();

// 获取配置信息
const info = getSupabaseInfo();
console.log('Supabase配置:', info);
```

### 3. 环境检测

```typescript
// 检测当前环境
if (import.meta.env.VITE_USE_ALIYUN_SUPABASE === 'true') {
  console.log('使用阿里云Supabase');
} else {
  console.log('使用本地Supabase');
}
```

## 🔑 获取访问密钥

### 1. 登录阿里云控制台

访问 [阿里云控制台](https://console.aliyun.com/)

### 2. 进入Supabase服务

- 搜索 "Supabase" 服务
- 选择您的项目 (ID: 1865238354801584)

### 3. 获取密钥

- **匿名密钥**: 用于前端应用
- **服务角色密钥**: 用于后端服务

## 🧪 测试连接

### 1. 启动开发服务器

```bash
npm run dev
```

### 2. 检查控制台

查看浏览器控制台是否有连接错误。

### 3. 测试API调用

```typescript
// 测试基本连接
const { data, error } = await supabase.from('users').select('count').limit(1);

if (error) {
  console.error('连接失败:', error);
} else {
  console.log('连接成功:', data);
}
```

## 🔍 故障排除

### 常见问题

1. **连接超时**
   - 检查网络连接
   - 确认阿里云实例状态

2. **认证失败**
   - 验证访问密钥
   - 检查密钥权限

3. **CORS错误**
   - 确认阿里云Supabase CORS配置
   - 检查域名白名单

### 调试模式

```typescript
// 启用调试模式
const supabase = createClient(url, key, {
  auth: {
    debug: true // 启用调试
  }
});
```

## 📁 文件结构

```
src/
├── supaClient.ts              # 原始客户端
├── supaClient.aliyun.ts       # 阿里云专用客户端
├── supaClient.updated.ts      # 配置切换客户端
├── config/
│   └── supabaseConfig.ts      # 配置管理
└── utils/
    └── retryUtils.ts          # 重试工具

.env                            # 环境变量 (自动生成)
env.aliyun.supabase.example     # 环境变量示例
setup-aliyun-env.sh            # 自动配置脚本
```

## 🔄 切换回本地

如果需要切换回本地Supabase：

```bash
# 方法1: 修改环境变量
VITE_USE_ALIYUN_SUPABASE=false

# 方法2: 恢复备份
cp .env.backup .env
```

## 📚 更多信息

- [阿里云Supabase文档](https://help.aliyun.com/zh/supabase/)
- [Supabase JavaScript客户端](https://supabase.com/docs/reference/javascript)
- [Vite环境变量配置](https://vitejs.dev/guide/env-and-mode.html)

---

**配置完成后，您的前端应用就可以使用阿里云Supabase了！** 🎉
