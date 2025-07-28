# 线索类权限 RLS 规则设置指南

## 概述

本指南描述了如何为线索类数据表（leads、followups、showings、deals）设置 Row Level Security (RLS) 权限规则，实现基于组织架构的递归权限管理。

## 权限设计原则

### 1. 权限层级
- **超级管理员**：可以管理所有数据
- **部门管理员**：可以管理自己部门及其递归子部门的数据
- **普通用户**：只能管理自己负责的数据

### 2. 递归管理逻辑
- 部门管理员可以管理递归子部门所有用户的数据
- 通过 `get_managed_org_ids()` 函数实现递归权限检查
- 支持多层级组织架构

### 3. 数据关联关系
- **leads**：线索基础信息
- **followups**：跟进记录，通过 `interviewsales_user_id` 关联用户
- **showings**：带看记录，通过 `showingsales` 和 `trueshowingsales` 关联用户
- **deals**：成交记录，通过关联的 followups 确定权限

## 部署步骤

### 第一步：检查表结构
在 Supabase SQL 编辑器中执行：
```sql
-- 检查表结构
\i check_table_structure.sql
```

### 第二步：部署基础权限
```sql
-- 部署基础权限规则
\i sql-scripts/setup/leads_permissions_rls_safe.sql
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
  AND tablename IN ('leads', 'followups', 'showings', 'deals')
ORDER BY tablename;

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
  AND tablename IN ('leads', 'followups', 'showings', 'deals')
ORDER BY tablename, policyname;
```

## 权限规则详解

### 1. SELECT 权限
- **超级管理员**：可以查看所有数据
- **部门管理员**：可以查看管理的组织及其子组织的数据
- **普通用户**：可以查看自己负责的数据

### 2. INSERT 权限
- **超级管理员**：可以创建所有数据
- **部门管理员**：可以为管理的组织成员创建数据
- **普通用户**：可以创建自己负责的数据

### 3. UPDATE 权限
- **超级管理员**：可以更新所有数据
- **部门管理员**：可以更新管理的组织及其子组织的数据
- **普通用户**：可以更新自己负责的数据

### 4. DELETE 权限
- **只有超级管理员**：可以删除数据
- **其他用户**：无删除权限

## 权限验证函数

### 检查用户权限
```sql
-- 检查特定用户的权限
SELECT * FROM test_leads_permissions('用户UUID');

-- 检查当前用户权限
SELECT * FROM test_leads_permissions(auth.uid());
```

### 验证递归权限
```sql
-- 获取用户管理的组织ID
SELECT * FROM get_managed_org_ids(auth.uid());

-- 检查用户是否为部门管理员
SELECT EXISTS (
  SELECT 1 FROM get_managed_org_ids(auth.uid())
) as is_department_admin;
```

## 前端集成

### 1. 更新权限 Hook
```typescript
// 在 usePermissions hook 中添加线索类权限检查
const canAccessLeads = (): boolean => {
  return isSuperAdmin || hasAnyRole(['admin', 'manager']) || isDepartmentAdmin;
};

const canCreateLeads = (): boolean => {
  return canAccessLeads();
};

const canEditLeads = (leadUserId: string): boolean => {
  if (isSuperAdmin || hasRole('admin')) {
    return true;
  }
  if (hasRole('manager') && canManageOrganization(leadUserOrgId)) {
    return true;
  }
  return leadUserId === currentUserId;
};
```

### 2. 权限组件
```typescript
// 权限控制组件
<PermissionGate requireLeadsAccess>
  <LeadsList />
</PermissionGate>

<PermissionGate requireLeadsCreate>
  <CreateLeadButton />
</PermissionGate>
```

## 故障排除

### 常见问题

1. **权限检查失败**
   - 检查用户 JWT token 是否有效
   - 检查数据库 RLS 策略是否正确
   - 检查组织架构关系是否正确

2. **递归权限不工作**
   - 检查 `get_managed_org_ids` 函数是否存在
   - 检查组织表的 `parent_id` 字段是否正确设置
   - 检查 `organizations.admin` 字段是否正确设置

3. **数据访问被拒绝**
   - 检查用户是否属于正确的组织
   - 检查数据是否关联到正确的用户
   - 检查 RLS 策略是否正确应用

### 调试方法

1. **检查用户身份**
```sql
SELECT 
  auth.uid() as current_user_id,
  up.nickname,
  up.organization_id,
  o.name as organization_name
FROM users_profile up
LEFT JOIN organizations o ON up.organization_id = o.id
WHERE up.user_id = auth.uid();
```

2. **检查组织权限**
```sql
SELECT 
  o.id,
  o.name,
  o.admin,
  o.parent_id
FROM organizations o
WHERE o.admin = auth.uid();
```

3. **检查递归权限**
```sql
SELECT * FROM get_managed_org_ids(auth.uid());
```

## 性能优化

### 1. 索引优化
```sql
-- 为权限检查字段创建索引
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON leads(created_by);
CREATE INDEX IF NOT EXISTS idx_followups_interviewsales_user_id ON followups(interviewsales_user_id);
CREATE INDEX IF NOT EXISTS idx_showings_showingsales ON showings(showingsales);
CREATE INDEX IF NOT EXISTS idx_showings_trueshowingsales ON showings(trueshowingsales);
CREATE INDEX IF NOT EXISTS idx_organizations_admin ON organizations(admin);
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);
```

### 2. 查询优化
- 使用 `EXISTS` 子查询而不是 `JOIN`
- 避免在 RLS 策略中使用复杂的函数调用
- 考虑使用物化视图缓存权限结果

## 安全考虑

1. **权限最小化**：只授予必要的权限
2. **数据隔离**：确保用户只能访问自己的数据
3. **审计日志**：记录重要的权限操作
4. **定期审查**：定期检查权限配置

## 扩展功能

### 1. 添加新的权限类型
```sql
-- 创建新的权限
INSERT INTO permissions (name, description, resource, action)
VALUES ('leads_export', '导出线索数据', 'leads', 'export');

-- 为用户分配权限
INSERT INTO user_permissions (user_id, permission_id, is_active)
VALUES ('用户ID', '权限ID', true);
```

### 2. 自定义权限规则
```sql
-- 创建自定义权限检查函数
CREATE OR REPLACE FUNCTION check_custom_leads_permission(
  p_user_id uuid,
  p_operation text,
  p_lead_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- 自定义权限逻辑
  RETURN true;
END;
$$;
```

## 总结

通过正确设置 RLS 规则，我们可以实现：

1. **数据安全**：确保用户只能访问授权的数据
2. **组织隔离**：支持多层级组织架构的权限管理
3. **递归权限**：部门管理员可以管理子部门数据
4. **灵活扩展**：支持添加新的权限类型和规则

这套权限系统为 CRM 系统提供了强大的数据安全保障，同时保持了良好的用户体验和管理灵活性。 