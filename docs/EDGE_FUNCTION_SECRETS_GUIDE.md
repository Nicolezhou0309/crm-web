# 🔐 阿里云Supabase边缘函数密钥管理完整指南

## 📋 概述

本文档详细说明如何在阿里云Supabase边缘函数中管理密钥和环境变量，包括本地开发和生产环境的配置方法。

## 🏠 本地开发环境密钥管理

### 方法1：通过 `.env` 文件（推荐）

在 `supabase/functions/` 目录下创建 `.env` 文件：

```bash
# 在项目根目录执行
cd supabase/functions
touch .env
```

#### `.env` 文件内容模板

```env
# ========================================
# Supabase 配置
# ========================================
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key_here

# ========================================
# 邮件服务配置 (SMTP)
# ========================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password_here
SMTP_FROM=noreply@yourcompany.com

# ========================================
# 微信企业应用配置
# ========================================
WECOM_CORP_ID=your_corp_id_here
WECOM_AGENT_ID=your_agent_id_here
WECOM_SECRET=your_secret_here

# ========================================
# 阿里云OSS配置
# ========================================
ALIYUN_ACCESS_KEY_ID=your_access_key_id_here
ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret_here
ALIYUN_OSS_BUCKET=your_bucket_name_here
ALIYUN_OSS_REGION=oss-cn-hangzhou

# ========================================
# 应用配置
# ========================================
APP_ENV=development
APP_DEBUG=true
LOG_LEVEL=debug
```

**重要说明**：
- 此文件会在 `supabase start` 时自动加载
- 不要将 `.env` 文件提交到版本控制系统
- 在 `.gitignore` 中添加 `supabase/functions/.env`

### 方法2：通过命令行参数

```bash
# 使用 --env-file 选项指定环境变量文件
supabase functions serve --env-file ./path/to/.env-file

# 例如：
supabase functions serve --env-file ./supabase/functions/.env.local
supabase functions serve --env-file ./supabase/functions/.env.development
```

## 🌐 生产环境密钥管理

### 使用 `supabase secrets` 命令

```bash
# 设置Supabase配置
supabase secrets set SUPABASE_URL=https://lead-service.vld.com.cn/supabase --project-ref aliyun-supabase
supabase secrets set SUPABASE_ANON_KEY=your_production_anon_key --project-ref aliyun-supabase
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key --project-ref aliyun-supabase

# 设置邮件服务配置
supabase secrets set SMTP_HOST=smtp.example.com --project-ref aliyun-supabase
supabase secrets set SMTP_USER=your_email@example.com --project-ref aliyun-supabase
supabase secrets set SMTP_PASS=your_email_password --project-ref aliyun-supabase

# 设置微信企业应用配置
supabase secrets set WECOM_CORP_ID=your_corp_id --project-ref aliyun-supabase
supabase secrets set WECOM_AGENT_ID=your_agent_id --project-ref aliyun-supabase
supabase secrets set WECOM_SECRET=your_secret --project-ref aliyun-supabase

# 设置阿里云OSS配置
supabase secrets set ALIYUN_ACCESS_KEY_ID=your_access_key_id --project-ref aliyun-supabase
supabase secrets set ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret --project-ref aliyun-supabase
supabase secrets set ALIYUN_OSS_BUCKET=your_bucket_name --project-ref aliyun-supabase
```

### 密钥管理操作

```bash
# 查看所有已设置的密钥
supabase secrets list --project-ref aliyun-supabase

# 查看特定密钥的值
supabase secrets get KEY_NAME --project-ref aliyun-supabase

# 删除不需要的密钥
supabase secrets unset KEY_NAME --project-ref aliyun-supabase

# 批量设置密钥（从文件）
supabase secrets set --env-file ./production.env --project-ref aliyun-supabase
```

## 🔍 在边缘函数中使用密钥

### 基本用法

```typescript
// 在边缘函数中访问环境变量
import { serve } from "https://deno.land/std@0.202.0/http/server.ts";

serve(async (req) => {
  try {
    // 获取环境变量
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const smtpHost = Deno.env.get('SMTP_HOST');
    
    // 验证必要的环境变量
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }
    
    console.log('Environment loaded:', {
      supabaseUrl,
      smtpHost: smtpHost || 'Not configured'
    });
    
    // 您的业务逻辑...
    
    return new Response(
      JSON.stringify({ message: 'Success' }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### 环境变量验证函数

```typescript
// 环境变量验证函数
function validateEnvironment() {
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS'
  ];
  
  const missing = requiredVars.filter(varName => !Deno.env.get(varName));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ 所有必需的环境变量已配置');
}

// 在函数开始时调用
validateEnvironment();
```

### 配置对象模式

```typescript
// 创建配置对象
const config = {
  supabase: {
    url: Deno.env.get('SUPABASE_URL'),
    anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  },
  smtp: {
    host: Deno.env.get('SMTP_HOST'),
    port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
    user: Deno.env.get('SMTP_USER'),
    pass: Deno.env.get('SMTP_PASS')
  },
  wecom: {
    corpId: Deno.env.get('WECOM_CORP_ID'),
    agentId: Deno.env.get('WECOM_AGENT_ID'),
    secret: Deno.env.get('WECOM_SECRET')
  },
  aliyun: {
    accessKeyId: Deno.env.get('ALIYUN_ACCESS_KEY_ID'),
    accessKeySecret: Deno.env.get('ALIYUN_ACCESS_KEY_SECRET'),
    ossBucket: Deno.env.get('ALIYUN_OSS_BUCKET'),
    ossRegion: Deno.env.get('ALIYUN_OSS_REGION')
  }
};

// 验证配置
function validateConfig() {
  const required = [
    config.supabase.url,
    config.supabase.anonKey,
    config.smtp.host,
    config.smtp.user,
    config.smtp.pass
  ];
  
  if (required.some(val => !val)) {
    throw new Error('Configuration validation failed');
  }
}
```

## 📋 密钥管理最佳实践

### 1. 安全性原则

- **最小权限原则**：只设置必要的密钥
- **定期轮换**：定期更新敏感密钥
- **环境隔离**：不同环境使用不同的密钥
- **加密存储**：敏感信息不要明文存储

### 2. 命名规范

- 使用大写字母和下划线
- 添加前缀标识服务类型
- 例如：`SMTP_HOST`、`WECOM_CORP_ID`、`ALIYUN_ACCESS_KEY_ID`

### 3. 版本控制

```bash
# .gitignore 文件应包含
supabase/functions/.env
supabase/functions/.env.local
supabase/functions/.env.development
supabase/functions/.env.production
*.env
```

### 4. 环境分离

```bash
# 开发环境
supabase/functions/.env.development

# 测试环境
supabase/functions/.env.test

# 生产环境
# 使用 supabase secrets set 命令
```

## 🚨 常见问题解决

### 1. 密钥未加载

```bash
# 检查本地环境变量是否正确加载
supabase functions serve --env-file ./supabase/functions/.env

# 验证生产环境密钥
supabase secrets list --project-ref aliyun-supabase

# 重新设置密钥
supabase secrets set KEY_NAME=new_value --project-ref aliyun-supabase
```

### 2. 权限问题

```bash
# 检查项目引用是否正确
supabase projects list

# 验证认证状态
supabase status

# 重新登录
supabase login
```

### 3. 密钥冲突

```bash
# 删除冲突的密钥
supabase secrets unset CONFLICT_KEY --project-ref aliyun-supabase

# 重新设置正确的密钥
supabase secrets set CORRECT_KEY=value --project-ref aliyun-supabase
```

## 🔧 自动化脚本

### 批量设置密钥脚本

```bash
#!/bin/bash
# set-production-secrets.sh

PROJECT_REF="aliyun-supabase"

echo "设置生产环境密钥..."

# Supabase配置
supabase secrets set SUPABASE_URL="https://lead-service.vld.com.cn/supabase" --project-ref $PROJECT_REF
supabase secrets set SUPABASE_ANON_KEY="your_anon_key" --project-ref $PROJECT_REF

# 邮件服务
supabase secrets set SMTP_HOST="smtp.example.com" --project-ref $PROJECT_REF
supabase secrets set SMTP_USER="your_email@example.com" --project-ref $PROJECT_REF
supabase secrets set SMTP_PASS="your_password" --project-ref $PROJECT_REF

# 微信企业应用
supabase secrets set WECOM_CORP_ID="your_corp_id" --project-ref $PROJECT_REF
supabase secrets set WECOM_AGENT_ID="your_agent_id" --project-ref $PROJECT_REF
supabase secrets set WECOM_SECRET="your_secret" --project-ref $PROJECT_REF

echo "密钥设置完成！"
```

### 密钥验证脚本

```bash
#!/bin/bash
# verify-secrets.sh

PROJECT_REF="aliyun-supabase"

echo "验证生产环境密钥..."

# 列出所有密钥
supabase secrets list --project-ref $PROJECT_REF

# 检查关键密钥
echo "检查关键密钥..."
supabase secrets get SUPABASE_URL --project-ref $PROJECT_REF
supabase secrets get SMTP_HOST --project-ref $PROJECT_REF
supabase secrets get WECOM_CORP_ID --project-ref $PROJECT_REF

echo "密钥验证完成！"
```

## 📚 相关文档

- [Supabase CLI 文档](https://supabase.com/docs/guides/cli)
- [边缘函数开发指南](https://supabase.com/docs/guides/functions)
- [Supabase 密钥管理](https://supabase.com/docs/guides/functions/secrets)
- [Deno 运行时文档](https://deno.land/manual)

---

**最后更新**: 2024年12月
**文档状态**: ✅ 完整
**适用环境**: 🏠 本地开发 + 🌐 生产环境
**安全级别**: 🔒 高
