import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export const usePermissions = () => {
  const [manageableOrganizations, setManageableOrganizations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDepartmentAdmin, setIsDepartmentAdmin] = useState(false);

  useEffect(() => {
    fetchManageableOrganizations();
  }, []);

  const fetchManageableOrganizations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setManageableOrganizations([]);
      setLoading(false);
      return;
    }

    // 检查是否为超级管理员
    const { data: { session } } = await supabase.auth.getSession();
    const isSuper = session?.access_token ? 
      JSON.parse(atob(session.access_token.split('.')[1])).role === 'service_role' : false;
    setIsSuperAdmin(isSuper);

    // 1. 查出我直接管理的部门
    const { data: myOrgs } = await supabase.from('organizations').select('id').eq('admin', user.id);
    let allOrgIds = myOrgs?.map(o => o.id) || [];

    // 2. 递归查所有下属部门
    const getChildren = async (parentIds: string[]): Promise<string[]> => {
      if (!parentIds.length) return [];
      const { data: children } = await supabase.from('organizations').select('id, parent_id').in('parent_id', parentIds);
      if (!children || !children.length) return [];
      const childIds = children.map(c => c.id);
      const subChildIds = await getChildren(childIds);
      return [...childIds, ...subChildIds];
    };
    const childOrgIds = await getChildren(allOrgIds);
    allOrgIds = [...allOrgIds, ...childOrgIds];

    setIsDepartmentAdmin(allOrgIds.length > 0);
    setManageableOrganizations(allOrgIds);
    setLoading(false);
  };

  // 判断是否能管理某部门
  const canManageOrganization = (orgId: string) => manageableOrganizations.includes(orgId);

  // 判断是否能管理某成员
  const canManageUser = (userOrgId: string) => manageableOrganizations.includes(userOrgId);

  // 获取可管理的组织列表
  const getManageableOrganizations = () => manageableOrganizations;

  return {
    manageableOrganizations,
    canManageOrganization,
    canManageUser,
    loading,
    isSuperAdmin,
    isDepartmentAdmin,
    getManageableOrganizations,
  };
}; 