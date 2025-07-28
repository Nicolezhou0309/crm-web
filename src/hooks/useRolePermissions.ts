import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supaClient';

interface UserRole {
  role_id: string;
  role_name: string;
  role_display_name: string;
  granted_at: string;
  is_active: boolean;
  expires_at?: string;
}

interface Permission {
  permission_name: string;
  permission_display_name: string;
  category: string;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description?: string;
}

interface OrganizationInfo {
  id: string;
  name: string;
  is_admin: boolean;
  level: number;
}

export const useRolePermissions = () => {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);
  const [manageableOrganizations, setManageableOrganizations] = useState<OrganizationInfo[]>([]);

  useEffect(() => {
    fetchUserData();
  }, []);

  // 安全解析JWT token
  const parseJwtToken = (token: string) => {
    try {
      if (!token || typeof token !== 'string') {
        return null;
      }
      
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return null;
      }
      
      const payload = tokenParts[1];
      if (!payload) {
        return null;
      }
      
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload + '='.repeat((4 - normalizedPayload.length % 4) % 4);
      
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(paddedPayload)) {
        return null;
      }
      
      const decodedPayload = atob(paddedPayload);
      const parsedPayload = JSON.parse(decodedPayload);
      
      return parsedPayload;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Token解析失败，跳过权限检查');
      }
      return null;
    }
  };

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
      const userRoles = (roles || []).map((r: any) => ({
        role_id: r.role_id,
        role_name: r.role_name,
        role_display_name: r.role_description || r.role_name,
        granted_at: '', // 如需显示可扩展后端
        is_active: true
      }));
      setUserRoles(userRoles);

      // 获取用户权限
      const { data: permissions, error: permissionsError } = await supabase.rpc('get_user_permissions', { p_user_id: userId });
      if (permissionsError) throw permissionsError;
      const userPermissions = (permissions || []).map((p: any) => ({
        permission_name: p.permission_name,
        permission_display_name: p.permission_description || p.permission_name,
        category: p.resource,
        resource: p.resource,
        action: p.action
      }));
      setUserPermissions(userPermissions);

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
      const isSuperAdmin = roleNames.includes('admin') || roleNames.includes('super_admin');
      const isSystemAdmin = roleNames.includes('admin') || roleNames.includes('system_admin');
      setIsSuperAdmin(isSuperAdmin);
      setIsSystemAdmin(isSystemAdmin);

      // 获取组织管理权限
      await fetchManageableOrganizations(userId, isSuperAdmin, roleNames.includes('admin'));

      // 打印权限调试信息
      console.log('🔐 [权限调试] 用户权限信息:', {
        userId,
        roles: userRoles.map((r: any) => r.role_name),
        permissions: userPermissions.map((p: any) => p.permission_name),
        isSuperAdmin,
        isSystemAdmin,
        hasApprovalManage: userPermissions.some((p: any) => p.permission_name === 'approval_manage')
      });

    } catch (error) {
      console.error('获取用户权限数据失败:', error);
      setUserRoles([]);
      setUserPermissions([]);
      setManageableOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取可管理的组织
  const fetchManageableOrganizations = async (userId: string, isSuper: boolean, hasAdminRole: boolean) => {
    try {
      let manageableOrgs: OrganizationInfo[] = [];
      
      // 如果是超级管理员或管理员，可以管理所有组织
      if (isSuper || hasAdminRole) {
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');
        
        manageableOrgs = allOrgs?.map(org => ({
          id: org.id,
          name: org.name,
          is_admin: true,
          level: 0
        })) || [];
        setIsDepartmentAdmin(true);
      } else {
        // 使用数据库函数获取可管理的组织（递归）
        const { data: managedOrgIds } = await supabase.rpc('get_managed_org_ids', { 
          admin_id: userId 
        });
        
        if (managedOrgIds && managedOrgIds.length > 0) {
          // 获取组织详细信息
          const { data: orgDetails } = await supabase
            .from('organizations')
            .select('id, name, admin')
            .in('id', managedOrgIds.map((org: any) => org.org_id));

          // 构建组织信息数组
          manageableOrgs = orgDetails?.map(org => ({
            id: org.id,
            name: org.name,
            is_admin: org.admin === userId,
            level: 0 // 可以根据需要计算层级
          })) || [];
          setIsDepartmentAdmin(manageableOrgs.length > 0);
        } else {
          setIsDepartmentAdmin(false);
        }
      }
      
      setManageableOrganizations(manageableOrgs);
    } catch (error) {
      console.error('获取可管理组织失败:', error);
      setManageableOrganizations([]);
      setIsDepartmentAdmin(false);
    }
  };

  // 检查是否有特定权限
  const hasPermission = useCallback((permission: string): boolean => {
    console.log(`🔐 [权限检查详情] 检查权限: ${permission}`);
    console.log(`🔐 [权限检查详情] 用户权限列表:`, userPermissions.map((p: any) => p.permission_name));
    console.log(`🔐 [权限检查详情] 超级管理员状态: ${isSuperAdmin}`);
    
    const hasPerm = isSuperAdmin || userPermissions.some((p: any) => p.permission_name === permission);
    console.log(`🔐 [权限检查] ${permission}: ${hasPerm} (超级管理员: ${isSuperAdmin})`);
    return hasPerm;
  }, [userPermissions, isSuperAdmin]);

  // 检查是否有多个权限中的任意一个
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    const hasAny = isSuperAdmin || permissions.some(permission => hasPermission(permission));
    console.log(`🔐 [权限检查] 任意权限 ${permissions.join(', ')}: ${hasAny}`);
    return hasAny;
  }, [hasPermission, isSuperAdmin]);

  // 检查是否有所有权限
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    const hasAll = isSuperAdmin || permissions.every(permission => hasPermission(permission));
    console.log(`🔐 [权限检查] 所有权限 ${permissions.join(', ')}: ${hasAll}`);
    return hasAll;
  }, [hasPermission, isSuperAdmin]);

  // 检查是否有特定角色
  const hasRole = useCallback((roleName: string): boolean => {
    const hasRolePerm = userRoles.some(role => role.role_name === roleName);
    console.log(`🔐 [角色检查] ${roleName}: ${hasRolePerm}`);
    return hasRolePerm;
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

  // 组织管理权限方法
  const canManageOrganization = useCallback((orgId: string): boolean => {
    return isSuperAdmin || manageableOrganizations.some(org => org.id === orgId);
  }, [isSuperAdmin, manageableOrganizations]);

  const canManageUser = useCallback((userOrgId: string): boolean => {
    return canManageOrganization(userOrgId);
  }, [canManageOrganization]);

  const getManageableOrganizationIds = useCallback((): string[] => {
    return manageableOrganizations.map(org => org.id);
  }, [manageableOrganizations]);

  const getManageableOrganizations = useCallback((): OrganizationInfo[] => {
    return manageableOrganizations;
  }, [manageableOrganizations]);

  return {
    userRoles,
    userPermissions,
    allRoles,
    loading,
    isSuperAdmin,
    isSystemAdmin,
    isDepartmentAdmin,
    manageableOrganizations,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    getUserRoleDisplayNames,
    getPermissionsByCategory,
    getExpiringRoles,
    refreshPermissions,
    // 组织管理权限
    canManageOrganization,
    canManageUser,
    getManageableOrganizationIds,
    getManageableOrganizations,
  };
}; 