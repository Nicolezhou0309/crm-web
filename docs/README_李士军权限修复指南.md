# 李士军账号权限修复指南

## 问题描述
李士军账号（北虹桥国际社区管理）无法查看到部门的线索，需要检查和修复递归管理逻辑。

## 解决方案步骤

### 第一步：诊断当前问题
1. 在Supabase SQL编辑器中执行 `debug_lijunshi_permissions.sql`
2. 查看输出结果，确认：
   - 李士军账号是否存在
   - 北虹桥国际社区组织是否存在
   - 用户与组织的关联关系
   - 现有的RLS策略状态

### 第二步：修复followups表权限策略
1. 在Supabase SQL编辑器中执行 `fix_followups_permissions.sql`
2. 这个脚本会：
   - 启用followups表的RLS
   - 创建正确的权限策略（包括递归管理逻辑）
   - 添加必要的辅助函数
   - 创建测试函数

### 第三步：配置李士军账号权限
1. 在Supabase SQL编辑器中执行 `setup_lijunshi_permissions.sql`
2. 这个脚本会：
   - 确保李士军被设置为北虹桥国际社区的管理员
   - 为李士军分配manager角色
   - 创建测试数据（如果需要）
   - 验证权限设置是否正确

### 第四步：前端权限检查
1. 检查前端的 `usePermissions.ts` 实现
2. 确保递归查询逻辑正确
3. 如果需要，刷新用户登录状态

## 权限逻辑说明

### 递归管理逻辑
系统实现了三级权限控制：

1. **个人权限**：用户可以查看自己创建的跟进记录
2. **管理员权限**：拥有admin角色的用户可以查看所有记录
3. **经理权限**：拥有manager角色或被设置为组织管理员的用户可以查看：
   - 自己直接管理的组织中的记录
   - 下属组织中的记录（递归）

### 组织层次结构
```
北虹桥国际社区 (李士军管理)
├── 子部门1
│   ├── 子子部门1
│   └── 子子部门2
└── 子部门2
```

李士军作为北虹桥国际社区的管理员，可以查看：
- 北虹桥国际社区直接成员的跟进记录
- 所有子部门和子子部门成员的跟进记录

## 验证方法

### 数据库层面验证
```sql
-- 检查李士军是否为组织管理员
SELECT * FROM organizations WHERE admin = (
    SELECT user_id FROM users_profile WHERE nickname ILIKE '%李士军%'
);

-- 检查李士军的角色
SELECT r.name FROM user_roles ur 
JOIN roles r ON ur.role_id = r.id 
WHERE ur.user_id = (
    SELECT user_id FROM users_profile WHERE nickname ILIKE '%李士军%'
);

-- 测试递归权限函数
SELECT get_manageable_organizations((
    SELECT user_id FROM users_profile WHERE nickname ILIKE '%李士军%'
));
```

### 前端验证
1. 用李士军账号登录系统
2. 访问跟进记录页面
3. 检查是否能看到部门成员的跟进记录
4. 检查权限提示和按钮状态

## 常见问题排查

### 问题1：仍然无法查看部门数据
**可能原因**：
- 前端缓存了旧的权限信息
- 用户需要重新登录

**解决方法**：
1. 清除浏览器缓存
2. 重新登录
3. 检查前端usePermissions hook的实现

### 问题2：RLS策略不生效
**可能原因**：
- PostgREST缓存了旧的schema
- 角色配置不正确

**解决方法**：
1. 重启Supabase服务或等待缓存刷新
2. 执行 `NOTIFY pgrst, 'reload schema';`
3. 检查角色是否正确分配

### 问题3：递归查询性能问题
**可能原因**：
- 组织层次过深
- 索引缺失

**解决方法**：
1. 检查organizations表的索引
2. 考虑限制递归深度
3. 优化查询条件

## 技术细节

### RLS策略实现
使用了WITH RECURSIVE CTE来实现组织层次结构的递归查询：

```sql
WITH RECURSIVE org_hierarchy AS (
    SELECT o.id, o.parent_id
    FROM organizations o
    JOIN users_profile up_1 ON up_1.organization_id = o.id
    WHERE up_1.user_id = auth.uid()
    
    UNION ALL
    
    SELECT o.id, o.parent_id
    FROM organizations o
    JOIN org_hierarchy oh_1 ON o.parent_id = oh_1.id
)
```

### 权限检查顺序
1. 检查是否为记录创建者
2. 检查是否为admin角色
3. 检查是否为manager角色且有递归权限

这种设计确保了性能和安全性的平衡。 