import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

interface UserRole {
  role_id: string;
  role_name: string;
  role_description: string;
}

interface OrganizationInfo {
  id: string;
  name: string;
  is_admin: boolean;
  level: number;
}

export const usePermissions = () => {
  const [manageableOrganizations, setManageableOrganizations] = useState<OrganizationInfo[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  const fetchUserPermissions = async () => {
    try {
      // 获取当前用户
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        resetPermissions();
        return;
      }

      // 检查是否为超级管理员（通过JWT token）
      const { data: { session } } = await supabase.auth.getSession();
      const isSuper = session?.access_token ? 
        JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
      setIsSuperAdmin(isSuper);
      
      // 获取用户角色
      const { data: roles } = await supabase.rpc('get_user_roles', { p_user_id: user.id });
      setUserRoles(roles || []);
      
      // 检查是否有管理员或经理角色
      const hasAdminRole = roles?.some((r: UserRole) => r.role_name === 'admin') || false;
      const hasManagerRole = roles?.some((r: UserRole) => r.role_name === 'manager') || false;
      setIsManager(hasManagerRole);
      
      // 如果是超级管理员，可以管理所有组织
      if (isSuper || hasAdminRole) {
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id, name')
          .order('name');
        
        setManageableOrganizations(
          allOrgs?.map(org => ({
            id: org.id,
            name: org.name,
            is_admin: true,
            level: 0
          })) || []
        );
        setIsDepartmentAdmin(true);
        setLoading(false);
        return;
      }

      // 使用数据库函数获取可管理的组织（递归）
      const { data: managedOrgIds, error: orgError } = await supabase.rpc('get_managed_org_ids', { 
        admin_id: user.id 
      });
      
      if (managedOrgIds && managedOrgIds.length > 0) {
        // 获取组织详细信息
        const { data: orgDetails } = await supabase
          .from('organizations')
          .select('id, name, admin')
          .in('id', managedOrgIds.map((org: any) => org.org_id));

        // 构建组织信息数组
        const orgInfos: OrganizationInfo[] = orgDetails?.map(org => ({
          id: org.id,
          name: org.name,
          is_admin: org.admin === user.id,
          level: 0 // 可以根据需要计算层级
        })) || [];

        setManageableOrganizations(orgInfos);
        setIsDepartmentAdmin(orgInfos.length > 0);
      } else {
        setManageableOrganizations([]);
        setIsDepartmentAdmin(false);
      }

    } catch (error) { 
      resetPermissions();
    } finally {
      setLoading(false);
    }
  };

  const resetPermissions = () => {
    setManageableOrganizations([]);
    setUserRoles([]);
    setIsSuperAdmin(false);
    setIsDepartmentAdmin(false);
    setIsManager(false);
    setLoading(false);
  };

  // 判断是否能管理某部门
  const canManageOrganization = (orgId: string): boolean => {
    const canManage = isSuperAdmin || manageableOrganizations.some(org => org.id === orgId);
    return canManage;
  };

  // 判断是否能管理某成员
  const canManageUser = (userOrgId: string): boolean => {
    const canManage = canManageOrganization(userOrgId);
    return canManage;
  };

  // 检查是否有特定角色
  const hasRole = (roleName: string): boolean => {
    // 由于get_user_roles函数没有返回is_active字段，我们假设所有返回的角色都是活跃的
    const hasRoleResult = userRoles.some(role => role.role_name === roleName);
    return hasRoleResult;
  };

  // 检查是否有任一角色
  const hasAnyRole = (roleNames: string[]): boolean => {
    const hasAnyRoleResult = roleNames.some(roleName => hasRole(roleName));
    return hasAnyRoleResult;
  };

  // 获取可管理的组织ID列表
  const getManageableOrganizationIds = (): string[] => {
    const orgIds = manageableOrganizations.map(org => org.id);
    return orgIds;
  };

  // 获取可管理的组织详细信息
  const getManageableOrganizations = (): OrganizationInfo[] => {
    return manageableOrganizations;
  };

  // 检查是否有followups访问权限
  const canAccessFollowups = (): boolean => {
    const canAccess = isSuperAdmin || hasAnyRole(['admin', 'manager']) || isDepartmentAdmin;
    return canAccess;
  };

  // 检查是否可以创建跟进记录
  const canCreateFollowups = (): boolean => {
    const canCreate = canAccessFollowups();
    return canCreate;
  };

  // 检查是否可以编辑特定的跟进记录
  const canEditFollowup = (followupUserId: string, followupUserOrgId?: string): boolean => {
    let canEdit = false;
    if (isSuperAdmin || hasRole('admin')) {
      canEdit = true;
    } else if (hasRole('manager') && followupUserOrgId && canManageOrganization(followupUserOrgId)) {
      canEdit = true;
    } else {
      canEdit = followupUserId === 'current_user_profile_id'; // 需要实际的用户profile ID
    }
    
    return canEdit;
  };

  // 检查是否可以删除跟进记录
  const canDeleteFollowup = (): boolean => {
    const canDelete = isSuperAdmin || hasRole('admin');
    return canDelete;
  };

  // 刷新权限信息
  const refreshPermissions = async () => {
    setLoading(true);
    await fetchUserPermissions();
  };

  return {
    // 基础权限信息
    loading,
    isSuperAdmin,
    isDepartmentAdmin,
    isManager,
    userRoles,
    
    // 组织管理权限
    manageableOrganizations,
    canManageOrganization,
    canManageUser,
    getManageableOrganizationIds,
    getManageableOrganizations,
    
    // 角色检查
    hasRole,
    hasAnyRole,
    
    // 功能权限
    canAccessFollowups,
    canCreateFollowups,
    canEditFollowup,
    canDeleteFollowup,
    
    // 工具函数
    refreshPermissions,
  };
}; 