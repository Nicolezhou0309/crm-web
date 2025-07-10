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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setManageableOrganizations([]);
        setLoading(false);
        return;
      }

      // 检查是否为超级管理员 - 修复atob解码错误
      const { data: { session } } = await supabase.auth.getSession();
      let isSuper = false;
      if (session?.access_token) {
        try {
          const tokenParts = session.access_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            isSuper = payload.role === 'service_role';
          }
        } catch (error) {
          console.error('Token解析失败:', error);
          isSuper = false;
        }
      }
      setIsSuperAdmin(isSuper);

      // 如果是超级管理员，可以管理所有组织
      if (isSuper) {
        const { data: allOrgs } = await supabase
          .from('organizations')
          .select('id')
          .order('name');
        
        setManageableOrganizations(allOrgs?.map(o => o.id) || []);
        setIsDepartmentAdmin(true);
        setLoading(false);
        return;
      }

      // 使用数据库函数获取可管理的组织（递归）
      const { data: managedOrgIds, error } = await supabase.rpc('get_managed_org_ids', { 
        admin_id: user.id 
      });

      if (error) {
        console.error('获取可管理组织失败:', error);
        setManageableOrganizations([]);
        setIsDepartmentAdmin(false);
      } else if (managedOrgIds && managedOrgIds.length > 0) {
        const orgIds = managedOrgIds.map((org: any) => org.org_id);
        setManageableOrganizations(orgIds);
        setIsDepartmentAdmin(orgIds.length > 0);
      } else {
        setManageableOrganizations([]);
        setIsDepartmentAdmin(false);
      }
    } catch (error) {
      console.error('获取权限信息失败:', error);
      setManageableOrganizations([]);
      setIsDepartmentAdmin(false);
    } finally {
      setLoading(false);
    }
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