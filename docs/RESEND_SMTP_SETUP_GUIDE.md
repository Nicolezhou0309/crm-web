# Resend SMTP 配置指南

## 📧 概述

本指南介绍如何在Supabase项目中配置和使用Resend作为SMTP服务提供商来发送邮件。

## 🚀 快速开始

### 1. 获取Resend API密钥

1. 访问 [Resend官网](https://resend.com)
2. 注册账户并登录
3. 在Dashboard中获取API密钥（格式：`re_xxxxxxxxxx`）

### 2. 配置Supabase环境变量

```bash
# 使用Supabase CLI设置环境变量
supabase secrets set RESEND_API_KEY=re_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz
```

### 3. 测试邮件发送

#### 方法一：直接API测试
```bash
# 运行测试脚本
node test_resend_direct.js
```

#### 方法二：Edge Function测试
```bash
# 部署Edge Function
supabase functions deploy test-email

# 使用测试页面
# 打开 test_email_page.html 在浏览器中测试
```

## 📋 重要注意事项

### 测试邮箱限制
- Resend在开发环境中只允许发送到特定的测试邮箱
- 推荐的测试邮箱：`delivered@resend.dev`
- 生产环境需要验证发件人域名

### 发件人域名
- 开发环境可以使用：`noreply@resend.dev`
- 生产环境需要验证您自己的域名

## 🔧 Edge Function示例

### test-email Edge Function

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ 
      error: 'RESEND_API_KEY is not configured' 
    }), { status: 500 })
  }

  try {
    const body = await req.json();
    const { to = 'delivered@resend.dev' } = body;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'noreply@resend.dev',
        to: to,
        subject: '测试邮件',
        html: '<h1>测试邮件内容</h1>'
      })
    })

    const data = await res.json()

    if (!res.ok) {
      return new Response(JSON.stringify({ 
        error: '发送邮件失败',
        details: data
      }), { status: res.status })
    }

    return new Response(JSON.stringify({
      success: true,
      data: data
    }), { status: 200 })
  } catch (err) {
    return new Response(JSON.stringify({ 
      error: '发送邮件失败',
      details: err.message 
    }), { status: 500 })
  }
})
```

## 🧪 测试工具

### 1. 直接API测试脚本
文件：`test_resend_direct.js`

```javascript
const RESEND_API_KEY = 're_2YubhDYo_3hkfnVejj7GG3BSN3WH65ZXz';

async function testResendDirect() {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'noreply@resend.dev',
      to: 'delivered@resend.dev',
      subject: '测试邮件',
      html: '<h1>测试邮件内容</h1>'
    })
  });

  const data = await response.json();
  console.log('响应状态:', response.status);
  console.log('响应数据:', data);
}

testResendDirect();
```

### 2. Web测试页面
文件：`test_email_page.html`

- 提供Web界面测试邮件发送
- 支持自定义收件人邮箱
- 实时显示发送结果

## 📊 常见错误及解决方案

### 1. 422错误 - 无效的收件人邮箱
```
Invalid `to` field. Please use our testing email address instead of domains like `example.com`.
```

**解决方案：** 使用Resend允许的测试邮箱，如 `delivered@resend.dev`

### 2. 401错误 - API密钥无效
```
Invalid JWT
```

**解决方案：** 检查API密钥是否正确设置

### 3. 500错误 - 环境变量未配置
```
RESEND_API_KEY is not configured
```

**解决方案：** 确保在Supabase中正确设置了环境变量

## 🔗 相关文件

- `supabase/functions/test-email/index.ts` - 测试邮件Edge Function
- `test_resend_direct.js` - 直接API测试脚本
- `test_email_page.html` - Web测试页面
- `test_email_function.js` - Supabase客户端测试脚本

## 📚 更多资源

- [Resend官方文档](https://resend.com/docs)
- [Supabase Edge Functions文档](https://supabase.com/docs/guides/functions)
- [Supabase环境变量配置](https://supabase.com/docs/guides/functions/secrets) 