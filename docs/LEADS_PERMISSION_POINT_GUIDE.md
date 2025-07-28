# Leads 表基于权限点的权限控制指南

## 概述

本指南描述了如何为 leads 表设置基于 `lead_manage` 权限点的权限控制，实现精确的权限管理。

## 权限设计原则

### 1. 权限检查机制
- **权限点检查**：检查用户是否拥有 `lead_manage` 权限
- **时间范围限制**：只允许操作90天内的记录
- **超级管理员特权**：超级管理员不受限制

### 2. 操作权限
- **SELECT**：查看90天内的记录
- **INSERT**：创建新记录
- **UPDATE**：更新90天内的记录
- **DELETE**：不允许删除（只有超级管理员可以删除）

### 3. 权限层级
- **超级管理员**：可以操作所有记录
- **有 lead_manage 权限的用户**：可以操作90天内的记录
- **普通用户**：无权限

## 部署步骤

### 第一步：确保权限点存在
```sql
-- 检查 lead_manage 权限是否存在
SELECT * FROM permissions WHERE name = 'lead_manage';

-- 如果不存在，创建权限点
INSERT INTO permissions (name, description, resource, action)
VALUES ('lead_manage', '线索管理权限', 'leads', 'manage')
ON CONFLICT (name) DO NOTHING;
```

### 第二步：部署权限规则
```sql
-- 在 Supabase SQL 编辑器中执行
\i sql-scripts/setup/leads_permissions_by_permission_point.sql
```

### 第三步：验证部署
```sql
-- 验证 RLS 已启用
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'leads';

-- 验证策略已创建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'leads'
ORDER BY policyname;
```

## 权限管理

### 1. 授予权限
```sql
-- 为特定用户授予 lead_manage 权限
SELECT grant_lead_manage_permission('用户UUID');

-- 示例：为李士军授予权限
SELECT grant_lead_manage_permission('李士军的用户UUID');
```

### 2. 移除权限
```sql
-- 移除用户的 lead_manage 权限
SELECT revoke_lead_manage_permission('用户UUID');
```

### 3. 检查权限
```sql
-- 检查当前用户权限
SELECT * FROM test_leads_permissions();

-- 检查特定用户权限
SELECT 
  up.user_id,
  p.name as permission_name,
  up.is_active
FROM user_permissions up
JOIN permissions p ON up.permission_id = p.id
WHERE p.name = 'lead_manage'
  AND up.user_id = '用户UUID';
```

## 权限验证

### 1. 权限检查函数
```sql
-- 检查是否有 lead_manage 权限
SELECT has_lead_manage_permission();

-- 检查是否为超级管理员
SELECT EXISTS (
  SELECT 1 FROM auth.users 
  WHERE id = auth.uid() 
  AND raw_user_meta_data->>'role' = 'service_role'
);
```

### 2. 时间范围检查
```sql
-- 检查记录是否在90天内
SELECT 
  leadid,
  created_at,
  is_within_90_days(created_at) as within_90_days
FROM leads
LIMIT 10;

-- 统计90天内的记录数
SELECT COUNT(*) as records_in_90_days
FROM leads 
WHERE created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days');
```

## 前端集成

### 1. 权限检查 Hook
```typescript
// 在 usePermissions hook 中添加
const hasLeadManagePermission = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('has_lead_manage_permission');
  return data || false;
};

const canAccessLeads = async (): Promise<boolean> => {
  const hasPermission = await hasLeadManagePermission();
  return isSuperAdmin || hasPermission;
};

const canCreateLeads = async (): Promise<boolean> => {
  return await canAccessLeads();
};

const canUpdateLeads = async (leadId: string): Promise<boolean> => {
  const hasPermission = await hasLeadManagePermission();
  if (isSuperAdmin || hasPermission) {
    // 检查记录是否在90天内
    const { data: lead } = await supabase
      .from('leads')
      .select('created_at')
      .eq('id', leadId)
      .single();
    
    if (lead) {
      const isWithin90Days = new Date(lead.created_at) >= 
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      return isWithin90Days;
    }
  }
  return false;
};
```

### 2. 权限组件
```typescript
// 权限控制组件
const LeadsPermissionGate: React.FC<{
  children: React.ReactNode;
  operation?: 'view' | 'create' | 'update' | 'delete';
}> = ({ children, operation = 'view' }) => {
  const { isSuperAdmin } = usePermissions();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermission = async () => {
      if (isSuperAdmin) {
        setHasPermission(true);
      } else {
        const hasLeadPermission = await hasLeadManagePermission();
        setHasPermission(hasLeadPermission);
      }
      setLoading(false);
    };
    
    checkPermission();
  }, [isSuperAdmin]);

  if (loading) {
    return <Spin />;
  }

  if (!hasPermission) {
    return <div>您没有权限执行此操作</div>;
  }

  return <>{children}</>;
};

// 使用示例
<LeadsPermissionGate operation="view">
  <LeadsList />
</LeadsPermissionGate>

<LeadsPermissionGate operation="create">
  <CreateLeadButton />
</LeadsPermissionGate>
```

## 数据查询示例

### 1. 查看有权限的记录
```sql
-- 查看当前用户有权限的 leads 记录
SELECT 
  leadid,
  phone,
  wechat,
  created_at,
  is_within_90_days(created_at) as within_90_days
FROM leads
WHERE has_lead_manage_permission() 
  AND is_within_90_days(created_at)
ORDER BY created_at DESC;
```

### 2. 统计信息
```sql
-- 统计90天内的记录
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_within_90_days(created_at) THEN 1 END) as records_in_90_days,
  COUNT(CASE WHEN NOT is_within_90_days(created_at) THEN 1 END) as records_outside_90_days
FROM leads;
```

## 故障排除

### 常见问题

1. **权限检查失败**
   ```sql
   -- 检查权限表结构
   SELECT * FROM permissions WHERE name = 'lead_manage';
   SELECT * FROM user_permissions WHERE permission_id = (
     SELECT id FROM permissions WHERE name = 'lead_manage'
   );
   ```

2. **时间范围不工作**
   ```sql
   -- 检查时间函数
   SELECT 
     CURRENT_TIMESTAMP as now,
     (CURRENT_TIMESTAMP - INTERVAL '90 days') as 90_days_ago,
     is_within_90_days(CURRENT_TIMESTAMP) as current_time_check;
   ```

3. **RLS 策略不生效**
   ```sql
   -- 检查 RLS 状态
   SELECT 
     schemaname,
     tablename,
     rowsecurity
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND tablename = 'leads';
   
   -- 检查策略
   SELECT * FROM pg_policies 
   WHERE schemaname = 'public' 
     AND tablename = 'leads';
   ```

### 调试方法

1. **检查用户权限**
   ```sql
   SELECT 
     auth.uid() as current_user,
     has_lead_manage_permission() as has_permission,
     EXISTS (
       SELECT 1 FROM auth.users 
       WHERE id = auth.uid() 
       AND raw_user_meta_data->>'role' = 'service_role'
     ) as is_super_admin;
   ```

2. **测试权限函数**
   ```sql
   -- 测试权限检查
   SELECT * FROM test_leads_permissions();
   ```

## 性能优化

### 1. 索引优化
```sql
-- 为时间范围查询创建索引
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

-- 为权限检查创建索引
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission_id ON user_permissions(permission_id);
```

### 2. 查询优化
- 使用 `EXISTS` 子查询而不是 `JOIN`
- 避免在 RLS 策略中使用复杂的函数调用
- 考虑使用物化视图缓存权限结果

## 安全考虑

1. **权限最小化**：只授予必要的权限
2. **时间限制**：限制操作范围在90天内
3. **删除保护**：防止误删除重要数据
4. **审计日志**：记录重要的权限操作

## 扩展功能

### 1. 自定义时间范围
```sql
-- 创建可配置的时间范围函数
CREATE OR REPLACE FUNCTION is_within_custom_days(
  p_date timestamptz,
  p_days integer DEFAULT 90
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_date >= (CURRENT_TIMESTAMP - INTERVAL '1 day' * p_days);
END;
$$;
```

### 2. 批量权限管理
```sql
-- 批量授予权限
CREATE OR REPLACE FUNCTION grant_lead_manage_to_users(p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  user_id uuid;
  granted_count integer := 0;
BEGIN
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    BEGIN
      PERFORM grant_lead_manage_permission(user_id);
      granted_count := granted_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- 记录错误但继续处理
        RAISE NOTICE 'Failed to grant permission to user %: %', user_id, SQLERRM;
    END;
  END LOOP;
  
  RETURN granted_count;
END;
$$;
```

## 总结

通过基于权限点的权限控制，我们实现了：

1. **精确权限控制**：基于 `lead_manage` 权限点进行权限检查
2. **时间范围限制**：只允许操作90天内的记录
3. **删除保护**：防止误删除重要数据
4. **灵活管理**：支持动态授予和移除权限
5. **性能优化**：通过索引和查询优化提高性能

这套权限系统为 leads 表提供了安全、灵活、高效的权限管理机制。 