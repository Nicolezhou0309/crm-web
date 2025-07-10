# 部门管理员功能说明

## 功能概述

部门管理员功能允许超级管理员为每个部门指定管理员，部门管理员可以管理自己部门的成员，但不能管理其他部门。

## 权限层级

### 超级管理员
- 可以创建、删除、修改所有部门
- 可以设置和移除部门管理员
- 可以管理所有用户

### 部门管理员
- 只能管理自己负责的部门
- 可以邀请新成员到本部门
- 可以调整本部门成员的部门归属
- 可以标记本部门成员为离职
- 不能删除部门或设置其他管理员

### 普通用户
- 只能查看自己部门的信息
- 只能管理个人资料

## 数据库设计

### organizations表新增字段
```sql
ALTER TABLE public.organizations 
ADD COLUMN admin UUID REFERENCES auth.users(id);
```

### RLS策略
- 部门管理员只能更新自己管理的部门
- 部门管理员只能管理本部门成员
- 只有超级管理员可以设置部门管理员

## 前端组件

### usePermissions Hook
```typescript
const { 
  isSuperAdmin, 
  isDepartmentAdmin, 
  canManageOrganization,
  adminOrganizations 
} = usePermissions();
```

### PermissionGate 组件
```typescript
<PermissionGate requireSuperAdmin>
  <Button>只有超级管理员可见</Button>
</PermissionGate>

<PermissionGate organizationId={orgId}>
  <Button>只有部门管理员可见</Button>
</PermissionGate>
```

## API接口

### Edge Function: manage-department-admins

#### 设置部门管理员
```bash
POST /functions/v1/manage-department-admins?action=set_admin
{
  "organization_id": "uuid",
  "admin_user_id": "uuid"
}
```

#### 移除部门管理员
```bash
POST /functions/v1/manage-department-admins?action=remove_admin
{
  "organization_id": "uuid"
}
```

#### 获取部门管理员信息
```bash
GET /functions/v1/manage-department-admins?action=get_admin&organization_id=uuid
```

## 部署步骤

1. 执行数据库脚本
```bash
# 在Supabase SQL编辑器中执行
database_schema.sql
```

2. 部署Edge Function
```bash
supabase functions deploy manage-department-admins
```

3. 测试功能
- 以超级管理员身份登录
- 创建部门并设置管理员
- 以部门管理员身份登录测试权限

## 使用示例

### 设置部门管理员
1. 超级管理员登录系统
2. 进入部门管理页面
3. 选择部门，点击"设置管理员"
4. 选择用户作为管理员
5. 确认设置

### 部门管理员操作
1. 部门管理员登录系统
2. 只能看到自己管理的部门
3. 可以邀请新成员
4. 可以调整成员部门
5. 可以标记成员离职

## 注意事项

1. 权限检查在多个层面进行：
   - 前端组件层面
   - API接口层面
   - 数据库RLS层面

2. 部门管理员不能：
   - 删除部门
   - 设置其他管理员
   - 管理其他部门

3. 超级管理员可以：
   - 管理所有部门
   - 设置和移除部门管理员
   - 管理所有用户

## 故障排除

### 权限检查失败
- 检查用户JWT token是否有效
- 检查数据库RLS策略是否正确
- 检查Edge Function是否正确部署

### 部门管理员无法管理成员
- 检查organizations表的admin字段是否正确设置
- 检查users_profile表的RLS策略
- 检查前端权限检查逻辑

### Edge Function调用失败
- 检查函数是否正确部署
- 检查请求头中的Authorization token
- 检查请求参数格式 