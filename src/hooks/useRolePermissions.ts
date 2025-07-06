import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supaClient';

export interface UserRole {
  role_id: string;
  role_name: string;
  role_display_name: string;
  granted_at?: string;
  expires_at?: string;
  is_active: boolean;
}

export interface Permission {
  permission_name: string;
  permission_display_name: string;
  category: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  is_system?: boolean;
  is_active?: boolean;
  created_at?: string;
}

export const useRolePermissions = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      // 获取当前用户ID
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error('未获取到用户ID');

      // 获取用户角色
      const { data: roles, error: rolesError } = await supabase.rpc('get_user_roles', { p_user_id: userId });
      if (rolesError) throw rolesError;
      setUserRoles(
        (roles || []).map((r: any) => ({
          role_id: r.role_id,
          role_name: r.role_name,
          role_display_name: r.role_description || r.role_name,
          granted_at: '', // 如需显示可扩展后端
          is_active: true
        }))
      );

      // 获取用户权限
      const { data: permissions, error: permissionsError } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
      if (permissionsError) throw permissionsError;
      setUserPermissions(
        (permissions || []).map((p: any) => ({
          permission_name: p.permission_name,
          permission_display_name: p.permission_description || p.permission_name,
          category: p.resource,
          resource: p.resource,
          action: p.action
        }))
      );

      // 获取所有角色（可选，若roles表有display_name字段可补充）
      const { data: allRolesData, error: allRolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (allRolesError) {
        setAllRoles([]);
      } else {
        setAllRoles(allRolesData || []);
      }

      // 检查管理员权限
      const roleNames = (roles || []).map((r: any) => r.role_name) || [];
      setIsSuperAdmin(roleNames.includes('admin') || roleNames.includes('super_admin'));
      setIsSystemAdmin(roleNames.includes('admin') || roleNames.includes('system_admin'));

    } catch (error) {
      console.error('获取用户权限数据失败:', error);
      setUserRoles([]);
      setUserPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  // 检查是否有特定权限
  const hasPermission = useCallback((permission: string): boolean => {
    if (isSuperAdmin) return true;
    return userPermissions.some(p => p.permission_name === permission);
  }, [userPermissions, isSuperAdmin]);

  // 检查是否有多个权限中的任意一个
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissions.some(permission => hasPermission(permission));
  }, [hasPermission, isSuperAdmin]);

  // 检查是否有所有权限
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (isSuperAdmin) return true;
    return permissions.every(permission => hasPermission(permission));
  }, [hasPermission, isSuperAdmin]);

  // 检查是否有特定角色
  const hasRole = useCallback((roleName: string): boolean => {
    return userRoles.some(role => role.role_name === roleName);
  }, [userRoles]);

  // 检查是否有多个角色中的任意一个
  const hasAnyRole = useCallback((roleNames: string[]): boolean => {
    return roleNames.some(roleName => hasRole(roleName));
  }, [hasRole]);

  // 获取用户角色显示名称
  const getUserRoleDisplayNames = useCallback((): string[] => {
    return userRoles.map(role => role.role_display_name);
  }, [userRoles]);

  // 获取权限按分类分组
  const getPermissionsByCategory = useCallback(() => {
    const grouped: Record<string, Permission[]> = {};
    userPermissions.forEach(permission => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = [];
      }
      grouped[permission.category].push(permission);
    });
    return grouped;
  }, [userPermissions]);

  // 检查角色是否即将过期（如有expires_at字段可用）
  const getExpiringRoles = useCallback((daysThreshold: number = 7): UserRole[] => {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    return userRoles.filter(role =>
      role.expires_at && new Date(role.expires_at) <= threshold
    );
  }, [userRoles]);

  // 刷新权限数据
  const refreshPermissions = useCallback(() => {
    fetchUserData();
  }, []);

  return {
    userRoles,
    userPermissions,
    allRoles,
    loading,
    isSuperAdmin,
    isSystemAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    getUserRoleDisplayNames,
    getPermissionsByCategory,
    getExpiringRoles,
    refreshPermissions,
  };
}; 