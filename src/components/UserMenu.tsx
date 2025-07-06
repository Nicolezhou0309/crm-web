import { Dropdown, Avatar } from 'antd';
import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';

const UserMenu = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { getUserRoleDisplayNames, isSuperAdmin, isSystemAdmin } = useRolePermissions();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleMenuClick = async (e: any) => {
    if (e.key === 'logout') {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    // 个人中心直接跳转即可，无需处理
  };

  const menuItems = [
    {
      key: 'profile',
      label: <a href="/profile">个人中心</a>,
    },
    {
      key: 'roles',
      label: <a href="/roles">角色权限</a>,
      // 只有管理员可以看到角色权限菜单
      ...(isSuperAdmin || isSystemAdmin ? {} : { style: { display: 'none' } })
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
    },
  ];

  const menuProps = {
    items: menuItems,
    onClick: handleMenuClick,
  };

  const userRoles = getUserRoleDisplayNames();

  return (
    <Dropdown menu={menuProps} placement="bottomRight">
      <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Avatar size="small" style={{ backgroundColor: isSuperAdmin ? '#f5222d' : isSystemAdmin ? '#1890ff' : '#52c41a' }}>
          {user?.user_metadata?.name?.[0] || user?.email?.[0] || 'U'}
        </Avatar>
        <span>
          {loading ? '加载中...' : (user?.user_metadata?.name || user?.email || '未登录')}
          {userRoles.length > 0 && (
            <span style={{ fontSize: '12px', color: '#999', marginLeft: '4px' }}>
              ({userRoles.join(', ')})
            </span>
          )}
        </span>
      </span>
    </Dropdown>
  );
};

export default UserMenu; 