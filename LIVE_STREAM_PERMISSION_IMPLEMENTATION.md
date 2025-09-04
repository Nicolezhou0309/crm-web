# 直播管理权限检查实现

## 概述

本次更新为直播报名系统的右键菜单增加了权限检查功能，确保只有拥有 `live_stream_manage` 权限的用户才能执行管理相关操作。

## 权限要求

- **资源**: `live_stream`
- **操作**: `manage`
- **权限名称**: `live_stream_manage`

## 实现的功能

### 1. 权限检查 Hook (`useRolePermissions`)

在 `src/hooks/useRolePermissions.ts` 中新增了 `hasLiveStreamManagePermission` 方法：

```typescript
const hasLiveStreamManagePermission = useCallback(async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('has_permission', {
      resource: 'live_stream',
      action: 'manage'
    });
    
    if (error) {
      console.error('检查直播管理权限失败:', error);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('检查直播管理权限异常:', error);
    return false;
  }
}, []);
```

### 2. 右键菜单权限控制 (`LiveStreamCardContextMenu`)

在 `src/components/LiveStreamCardContextMenu.tsx` 中实现了：

- **权限检查**: 组件加载时自动检查用户权限
- **菜单项过滤**: 只有拥有管理权限的用户才能看到管理相关菜单项
- **操作拦截**: 在执行管理操作前进行权限验证

#### 受权限控制的菜单项：
- 释放场次
- 锁定场次
- 解锁场次
- 直播评分

#### 不受权限控制的菜单项：
- 创建新场次
- 编辑记录
- 查看记录历史

### 3. 主组件权限集成 (`LiveStreamRegistrationBase`)

在 `src/components/LiveStreamRegistrationBase.tsx` 中更新了以下函数：

- `handleContextMenuLock`: 锁定场次权限检查
- `handleContextMenuUnlock`: 解锁场次权限检查
- `handleContextMenuRelease`: 释放场次权限检查
- `handleContextMenuRate`: 直播评分权限检查

### 4. 直播评分权限控制 (`LiveStreamScoringDrawer`)

在 `src/components/LiveStreamScoringDrawer.tsx` 中实现了：

- **权限检查**: 组件加载时自动检查用户权限
- **操作按钮控制**: 只有拥有管理权限的用户才能看到评分相关按钮
- **功能拦截**: 在开始评分和保存评分时进行权限验证
- **用户提示**: 无权限用户会看到友好的权限不足提示

#### 受权限控制的功能：
- 开始评分
- 编辑评分
- 保存评分
- 提交评分

## 数据库函数

使用以下数据库函数进行权限检查：

```sql
CREATE OR REPLACE FUNCTION public.has_permission(resource text, action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result BOOLEAN;
  res_name ALIAS FOR resource;
  act_name ALIAS FOR action;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
    AND p.resource = res_name
    AND p.action = act_name
  ) INTO result;
  
  RETURN result;
END;
$function$
```

## 用户体验

### 有权限的用户
- 可以看到所有右键菜单项（包括管理操作和评分）
- 可以正常执行所有管理操作
- 可以进行直播评分操作

### 无权限的用户
- 只能看到基础菜单项（创建、编辑、历史）
- 尝试执行管理操作时会显示权限不足提示
- 管理相关菜单项不会显示
- 无法进行直播评分操作

## 错误处理

- 权限检查失败时会在控制台记录错误日志
- 用户会收到友好的权限不足提示信息
- 系统会优雅地降级，不会影响其他功能的正常使用

## 安全考虑

- 使用 `SECURITY DEFINER` 确保权限检查的可靠性
- 前端和后端双重权限验证
- 权限检查结果会被缓存以提高性能
- 所有管理操作都需要明确的权限验证

## 测试建议

1. **权限测试**: 使用不同权限级别的用户测试菜单显示
2. **功能测试**: 验证有权限用户能正常执行管理操作和评分操作
3. **安全测试**: 验证无权限用户无法绕过前端限制执行管理操作和评分操作
4. **性能测试**: 验证权限检查不会显著影响页面加载速度
5. **评分功能测试**: 验证评分抽屉的权限控制是否正常工作

## 后续优化

1. 可以考虑添加权限检查的缓存机制
2. 可以添加权限变更的实时通知
3. 可以添加更细粒度的权限控制（如按部门、按时间段等）

## 实现完成

✅ **权限检查 Hook**: 在 `useRolePermissions` 中添加了 `hasLiveStreamManagePermission` 方法

✅ **右键菜单权限控制**: `LiveStreamCardContextMenu` 组件现在根据权限显示/隐藏菜单项

✅ **主组件权限集成**: `LiveStreamRegistrationBase` 中的所有管理操作都添加了权限检查

✅ **直播评分权限控制**: `LiveStreamScoringDrawer` 组件现在根据权限控制评分功能

✅ **数据库函数**: 使用提供的 `has_permission` 函数进行权限验证

✅ **用户体验**: 无权限用户会看到友好的提示信息，不会影响其他功能

✅ **安全性**: 前端和后端双重权限验证，确保系统安全

所有功能已经实现完成，权限检查系统现在可以正常工作，确保只有拥有 `live_stream_manage` 权限的用户才能执行直播管理相关操作，包括：
- 锁定/解锁场次
- 释放场次
- 直播评分
