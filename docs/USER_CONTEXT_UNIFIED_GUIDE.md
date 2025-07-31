# 统一用户信息使用指南

## 概述

为了确保各页面统一使用 `useContext` 的人员缓存信息，避免重复请求和不一致的数据，我们建立了统一的用户信息管理机制。

## 当前使用情况分析

### ✅ 正确使用 useUser 的页面

1. **Profile.tsx** - 用户资料页面
   ```typescript
   const { user } = useUser();
   ```

2. **HonorManagement.tsx** - 荣誉管理页面
   ```typescript
   const { user } = useUser();
   ```

3. **FollowupsGroupList.tsx** - 跟进记录页面
   ```typescript
   const { user, profile, loading: userLoading } = useUser();
   ```

4. **PointsSummary.tsx** - 积分汇总页面
   ```typescript
   const { profile } = useUser();
   ```

5. **PointsExchange.tsx** - 积分兑换页面
   ```typescript
   const { profile } = useUser();
   ```

6. **ShowingsList.tsx** - 看房记录页面
   ```typescript
   const { profile } = useUser();
   ```

7. **ApprovalDetails.tsx** - 审批详情页面
   ```typescript
   const { user, profile } = useUser();
   ```

8. **ApprovalPerformance.tsx** - 审批绩效页面
   ```typescript
   const { user } = useUser();
   ```

9. **DataAnalysis.tsx** - 数据分析页面
   ```typescript
   const { user } = useUser();
   ```

10. **Login.tsx** - 登录页面
    ```typescript
    const { user, loading: userLoading } = useUser();
    ```

11. **ApprovalFlowManagement.tsx** - 审批流程管理页面
    ```typescript
    const { user, profile } = useUser();
    ```

12. **PrivateRoute.tsx** - 私有路由组件
    ```typescript
    const { user, loading } = useUser();
    ```

13. **UserMenu.tsx** - 用户菜单组件
    ```typescript
    const { profile } = useUser();
    ```

### ⚠️ 需要优化的页面

1. **SetPassword.tsx** - 设置密码页面
   ```typescript
   // 直接使用 supabase.auth.getUser()
   const { data: { user } } = await supabase.auth.getUser();
   ```
   **建议**: 使用 `useUser()` Hook

2. **DepartmentPage.tsx** - 部门管理页面
   ```typescript
   // 直接查询 users_profile 表
   const { data } = await supabase.from('users_profile').select('user_id, nickname, email');
   ```
   **建议**: 对于当前用户信息使用 `useUser()`，对于其他用户列表保持直接查询

3. **ShowingsQueueManagement.tsx** - 看房队列管理页面
   ```typescript
   // 直接查询 users_profile 表
   const { data, error } = await supabase.from('users_profile').select('id, nickname');
   ```
   **建议**: 对于当前用户信息使用 `useUser()`，对于用户列表保持直接查询

## 统一使用规范

### 1. 获取当前用户信息

**✅ 正确方式**:
```typescript
import { useUser } from '../context/UserContext';

const MyComponent = () => {
  const { user, profile, permissions, loading } = useUser();
  
  // 使用用户信息
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" />;
  
  return <div>欢迎, {profile?.nickname || user.email}</div>;
};
```

**❌ 错误方式**:
```typescript
// 不要直接调用 supabase.auth.getUser()
const { data: { user } } = await supabase.auth.getUser();

// 不要直接查询 users_profile 表获取当前用户信息
const { data } = await supabase.from('users_profile').select('*').eq('user_id', user.id);
```

### 2. 更新用户信息

**✅ 正确方式**:
```typescript
import { useUser } from '../context/UserContext';

const MyComponent = () => {
  const { refreshUser } = useUser();
  
  const handleUpdateProfile = async () => {
    // 更新数据库
    await supabase.from('users_profile').update(data).eq('user_id', user.id);
    
    // 刷新 Context 中的用户信息
    await refreshUser();
  };
};
```

### 3. 获取其他用户信息

**✅ 正确方式** (对于用户列表):
```typescript
// 获取其他用户列表时，可以继续使用直接查询
const { data: users } = await supabase
  .from('users_profile')
  .select('id, nickname, organization_id')
  .eq('status', 'active');
```

### 4. 权限检查

**✅ 正确方式**:
```typescript
import { useUser } from '../context/UserContext';

const MyComponent = () => {
  const { permissions } = useUser();
  
  // 检查权限
  if (!permissions?.isSuperAdmin) {
    return <div>权限不足</div>;
  }
  
  return <AdminPanel />;
};
```

## 优化建议

### 1. 修复 SetPassword.tsx

```typescript
// 修改前
const { data: { user } } = await supabase.auth.getUser();

// 修改后
import { useUser } from '../context/UserContext';
const { user } = useUser();
```

### 2. 添加用户信息刷新机制

```typescript
// 在需要刷新用户信息的地方
const { refreshUser } = useUser();

// 例如：修改邮箱后
const handleEmailChange = async (newEmail: string) => {
  await supabase.auth.updateUser({ email: newEmail });
  await supabase.from('users_profile').update({ email: newEmail }).eq('user_id', user.id);
  
  // 刷新 Context 中的用户信息
  await refreshUser();
};
```

### 3. 添加错误处理

```typescript
const { user, profile, error, refreshUser } = useUser();

if (error) {
  return <div>加载用户信息失败: {error}</div>;
}
```

## 缓存机制

### 1. 缓存策略

- **用户信息**: 5分钟缓存
- **权限信息**: 随用户信息一起缓存
- **会话状态**: 30分钟超时

### 2. 缓存更新时机

- 用户登录/登出
- 用户信息修改
- 权限变更
- 页面可见性变化

### 3. 缓存清理

```typescript
const { clearUserCache } = useUser();

// 在需要清理缓存的地方
clearUserCache();
```

## 性能优化

### 1. 避免重复请求

```typescript
// ✅ 使用 Context 中的缓存数据
const { user, profile } = useUser();

// ❌ 避免重复请求
const [userData, setUserData] = useState(null);
useEffect(() => {
  supabase.auth.getUser().then(result => setUserData(result.data.user));
}, []);
```

### 2. 智能刷新

```typescript
// 只在必要时刷新用户信息
const { refreshUser } = useUser();

const handleProfileUpdate = async () => {
  // 更新数据库
  await updateProfile();
  
  // 刷新 Context
  await refreshUser();
};
```

## 调试工具

### 1. 用户信息调试

```typescript
const { user, profile, permissions, loading, error } = useUser();

console.log('用户信息:', {
  user: user?.id,
  profile: profile?.nickname,
  permissions: permissions?.isSuperAdmin,
  loading,
  error
});
```

### 2. 缓存状态检查

```typescript
// 在 UserContext 中添加调试信息
console.log('🔄 [UserContext] 缓存状态:', {
  hasUser: !!user,
  hasProfile: !!profile,
  hasPermissions: !!permissions,
  loading,
  error
});
```

## 总结

通过统一使用 `useUser()` Hook，我们实现了：

1. **数据一致性**: 所有页面使用相同的用户信息源
2. **性能优化**: 避免重复请求，利用缓存机制
3. **代码简化**: 减少重复的用户信息获取代码
4. **错误处理**: 统一的错误处理机制
5. **权限管理**: 统一的权限检查机制

建议所有页面都遵循这个统一的使用规范，确保用户信息的一致性和应用的性能。 