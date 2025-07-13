# 通知删除功能修复指南

## 🚨 问题描述

用户反馈：**通知删除功能失败，只有前端删除，后端无响应。**

## 🔍 问题分析

### 可能的原因

1. **RLS策略缺失**：数据库缺少DELETE权限的RLS策略
2. **Edge Function权限问题**：Edge Function无法正确删除通知
3. **用户ID映射问题**：auth.uid()与notifications.user_id映射错误
4. **API调用失败**：前端API调用后端失败

### 当前状态

- ✅ Edge Function已正确实现删除逻辑
- ✅ 前端API调用正确
- ❓ RLS策略可能缺少DELETE权限
- ❓ 需要验证用户权限映射

## 🛠️ 解决方案

### 方案一：修复RLS策略（推荐）

#### 1. 执行RLS策略修复脚本

```bash
# 连接到数据库并执行修复脚本
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[YOUR_PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" -f fix_notification_delete_rls.sql
```

#### 2. 修复脚本内容

```sql
-- 添加DELETE权限的RLS策略
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);
```

### 方案二：手动修复RLS策略

#### 1. 检查当前策略

```sql
-- 查看当前notifications表的RLS策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'notifications'
ORDER BY policyname;
```

#### 2. 添加DELETE策略

```sql
-- 确保RLS已启用
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 添加删除策略
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);
```

### 方案三：测试验证

#### 1. 运行测试脚本

```bash
node test_delete_notification_simple.js
```

#### 2. 检查测试结果

- 如果测试通过：RLS策略正确
- 如果测试失败：需要修复RLS策略

## 🔧 技术细节

### RLS策略说明

```sql
-- 完整的notifications表RLS策略
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own notifications" ON notifications
FOR INSERT WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
) WITH CHECK (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);

-- 新增：用户删除自己的通知
CREATE POLICY "Users can delete their own notifications" ON notifications
FOR DELETE USING (
  user_id = (
    SELECT id FROM users_profile 
    WHERE user_id = auth.uid()
  )
);
```

### Edge Function逻辑

```typescript
// 删除通知的完整流程
async function deleteNotification(supabase: any, params: URLSearchParams, user: any) {
  const notification_id = params.get('id');
  
  // 1. 获取用户profileId
  const { data: profile } = await supabase
    .from('users_profile')
    .select('id')
    .eq('user_id', user.id)
    .single();
    
  // 2. 查找通知
  const { data: notification } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('id', notification_id)
    .single();
    
  // 3. 权限验证
  if (notification.user_id !== profile.id) {
    return new Response(JSON.stringify({ error: '无权删除此通知' }), { status: 403 });
  }
  
  // 4. 删除通知
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notification_id);
    
  if (error) throw error;
  
  return new Response(JSON.stringify({ success: true, message: '通知已删除' }), { status: 200 });
}
```

## 🧪 测试步骤

### 1. 前端测试

1. 登录系统
2. 点击通知铃铛打开通知中心
3. 点击通知列表中的删除按钮
4. 确认通知是否被删除

### 2. 后端测试

```bash
# 运行测试脚本
node test_delete_notification_simple.js
```

### 3. 日志检查

1. 打开浏览器开发者工具
2. 查看Console日志
3. 检查Network请求
4. 查看Edge Function日志

## 📋 检查清单

- [ ] RLS策略包含DELETE权限
- [ ] Edge Function正确部署
- [ ] 前端API调用正确
- [ ] 用户权限映射正确
- [ ] 测试脚本通过
- [ ] 前端删除功能正常

## 🚀 部署步骤

### 1. 修复RLS策略

```bash
# 执行修复脚本
psql "postgresql://postgres.wteqgprgiylmxzszcnws:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" -f fix_notification_delete_rls.sql
```

### 2. 重新部署Edge Function

```bash
supabase functions deploy notification-system
```

### 3. 测试功能

```bash
# 运行测试
node test_delete_notification_simple.js

# 前端测试
# 在浏览器中测试删除功能
```

## 🎯 预期结果

修复后，用户应该能够：

1. ✅ 在前端界面删除自己的通知
2. ✅ 删除操作立即生效
3. ✅ 通知从列表中消失
4. ✅ 未读计数正确更新
5. ✅ 删除操作有成功提示

## 🔍 故障排除

### 如果删除仍然失败

1. **检查RLS策略**：确认DELETE策略已添加
2. **检查Edge Function日志**：查看详细错误信息
3. **检查用户权限**：确认用户有正确的profile记录
4. **检查通知归属**：确认通知属于当前用户

### 常见错误

- `permission denied`：RLS策略问题
- `not found`：通知不存在或权限不足
- `invalid user`：用户ID映射问题

## 📞 支持

如果问题仍然存在，请：

1. 检查Edge Function日志
2. 运行测试脚本并分享结果
3. 提供具体的错误信息
4. 确认RLS策略状态 