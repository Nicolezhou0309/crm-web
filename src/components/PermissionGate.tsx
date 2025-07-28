import React from 'react';
import { useRolePermissions } from '../hooks/useRolePermissions';
import LoadingScreen from './LoadingScreen';

interface PermissionGateProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAllPermissions?: boolean;
  role?: string;
  roles?: string[];
  requireAllRoles?: boolean;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
  organizationId?: string;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permission,
  permissions = [],
  requireAllPermissions = false,
  role,
  roles = [],
  requireAllRoles = false,
  fallback = null,
  loading = <LoadingScreen type="auth" />,
  organizationId
}) => {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    canManageOrganization,
    loading: permissionsLoading 
  } = useRolePermissions();

  if (permissionsLoading) {
    console.log(`⏳ [权限门控] 权限加载中...`);
    return <>{loading}</>;
  }

  // 检查权限
  if (permission) {
    const hasPerm = hasPermission(permission);
    console.log(`🔐 [权限门控] 检查权限 ${permission}: ${hasPerm}`);
    if (!hasPerm) {
      console.log(`🚫 [权限门控] 权限不足，显示fallback`);
      return <>{fallback}</>;
    }
  }

  if (permissions.length > 0) {
    const hasRequiredPermissions = requireAllPermissions 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    console.log(`🔐 [权限门控] 检查权限组 ${permissions.join(', ')} (${requireAllPermissions ? '全部' : '任意'}): ${hasRequiredPermissions}`);
    if (!hasRequiredPermissions) {
      console.log(`🚫 [权限门控] 权限组不足，显示fallback`);
      return <>{fallback}</>;
    }
  }

  // 检查角色
  if (role) {
    const hasRolePerm = hasRole(role);
    console.log(`🔐 [权限门控] 检查角色 ${role}: ${hasRolePerm}`);
    if (!hasRolePerm) {
      console.log(`🚫 [权限门控] 角色不足，显示fallback`);
      return <>{fallback}</>;
    }
  }

  if (roles.length > 0) {
    const hasRequiredRoles = requireAllRoles 
      ? roles.every(role => hasRole(role))
      : hasAnyRole(roles);
    
    console.log(`🔐 [权限门控] 检查角色组 ${roles.join(', ')} (${requireAllRoles ? '全部' : '任意'}): ${hasRequiredRoles}`);
    if (!hasRequiredRoles) {
      console.log(`🚫 [权限门控] 角色组不足，显示fallback`);
      return <>{fallback}</>;
    }
  }

  // 如果有organizationId，检查是否有权限管理该组织
  if (organizationId) {
    const canManage = canManageOrganization(organizationId);
    console.log(`🔐 [权限门控] 检查组织权限 ${organizationId}: ${canManage}`);
    if (!canManage) {
      console.log(`🚫 [权限门控] 组织权限不足，显示fallback`);
      return <>{fallback}</>;
    }
  }

  console.log(`✅ [权限门控] 权限检查通过，显示内容`);
  return <>{children}</>;
};

// 便捷组件
export const SuperAdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <PermissionGate role="super_admin" fallback={fallback}>
    {children}
  </PermissionGate>
);

export const SystemAdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <PermissionGate roles={['super_admin', 'system_admin']} fallback={fallback}>
    {children}
  </PermissionGate>
);

export const AdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback
}) => (
  <PermissionGate roles={['super_admin', 'system_admin', 'department_admin']} fallback={fallback}>
    {children}
  </PermissionGate>
);

// 权限检查Hook
export const usePermissionCheck = () => {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isSystemAdmin
  } = useRolePermissions();

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    isSuperAdmin,
    isSystemAdmin
  };
}; 