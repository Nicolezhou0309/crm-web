# 认证403错误修复指南

## 问题描述

用户反馈密码登录成功后，在获取用户信息时出现403 Forbidden错误：

```
GET https://lead-service.vld.com.cn/supabase/auth/v1/user 403 (Forbidden)
AuthRetryableFetchError: Failed to fetch
```

## 问题分析

通过分析错误日志和配置，发现问题的根本原因是：

1. **nginx代理配置缺少API密钥**：nginx代理Supabase请求时没有设置正确的API密钥
2. **认证流程中断**：密码登录成功后，获取用户信息时因为缺少API密钥导致403错误

## 修复方案

### 1. 更新nginx配置

在nginx配置的Supabase代理部分添加正确的API密钥：

```nginx
# Supabase API代理配置
location /supabase/ {
    proxy_pass https://lead-service.vld.com.cn/supabase/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # 添加正确的Supabase API密钥
    proxy_set_header apikey "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg";
    proxy_set_header Authorization "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzU1Nzg1ODY3LCJleHAiOjEzMjY2NDI1ODY3fQ.h_DW3s03LaUCtf_7LepkEwmFVxdqPZ6zfHhuSMc5Ewg";
    
    # ... 其他配置保持不变
}
```

### 2. 部署步骤

#### 方法一：使用修复脚本（推荐）

1. 将修复后的nginx配置上传到服务器：
```bash
scp nginx-lead-service.conf root@47.123.26.25:/etc/nginx/conf.d/lead-service.conf
```

2. 在服务器上运行修复脚本：
```bash
ssh root@47.123.26.25
cd /root
./fix-nginx-auth.sh
```

#### 方法二：手动修复

1. 备份当前配置：
```bash
cp /etc/nginx/conf.d/lead-service.conf /etc/nginx/conf.d/lead-service.conf.backup
```

2. 更新nginx配置：
```bash
# 编辑配置文件
nano /etc/nginx/conf.d/lead-service.conf

# 在Supabase代理配置部分添加API密钥
```

3. 测试配置并重新加载：
```bash
nginx -t
systemctl reload nginx
```

### 3. 验证修复

修复完成后，请验证以下功能：

1. **密码登录**：使用邮箱和密码登录
2. **用户信息获取**：登录成功后应该能正常获取用户信息
3. **页面跳转**：登录成功后应该能正常跳转到主页面

## 技术细节

### 问题根因

- Supabase客户端在发送认证请求时，需要在请求头中包含正确的API密钥
- nginx代理没有转发这些必要的认证头，导致后端Supabase服务返回403错误
- 密码登录成功是因为登录请求直接发送到Supabase，但获取用户信息的请求通过nginx代理时缺少认证头

### 修复原理

- 在nginx代理配置中添加`proxy_set_header apikey`和`proxy_set_header Authorization`
- 确保所有通过nginx代理的Supabase请求都包含正确的认证信息
- 保持与直接访问Supabase服务相同的认证机制

## 相关文件

- `nginx-lead-service.conf` - 修复后的nginx配置文件
- `fix-nginx-auth.sh` - 自动修复脚本
- `.env` - 环境变量配置（包含正确的API密钥）

## 注意事项

1. **API密钥安全**：确保API密钥不会泄露到日志或公共代码中
2. **配置备份**：修改前务必备份原始配置
3. **测试验证**：修复后需要全面测试认证流程
4. **监控日志**：关注nginx和Supabase的访问日志，确保没有其他问题

## 预期结果

修复后，用户应该能够：
- 正常使用密码登录
- 登录成功后立即获取用户信息
- 正常跳转到主页面
- 不再出现403 Forbidden错误
