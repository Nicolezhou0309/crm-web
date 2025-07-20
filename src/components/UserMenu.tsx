import { Dropdown } from 'antd';
import { useEffect } from 'react';
import { supabase } from '../supaClient';
import { useUser } from '../context/UserContext';

export function useUserMenuAvatarUrl() {
  const { profile } = useUser();
  return profile?.avatar_url;
}

const UserMenu = () => {
  const { refreshUser } = useUser();

  // 监听全局刷新口令
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'avatar_refresh_token') {
        refreshUser();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refreshUser]);

  useEffect(() => {
    const handleAvatarRefresh = () => {
      refreshUser();
    };
    window.addEventListener('avatar_refresh_token', handleAvatarRefresh);
    return () => window.removeEventListener('avatar_refresh_token', handleAvatarRefresh);
  }, [refreshUser]);

  const menuItems = [
    {
      key: 'profile',
      label: <a href="/profile">个人中心</a>,
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
    onClick: async (e: any) => {
      if (e.key === 'logout') {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    },
  };

  return (
    <div>
      {/* 用户菜单Dropdown */}
      <Dropdown menu={menuProps} placement="bottomRight">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          {/* 头像和头像框已移除，这里只保留菜单入口 */}
        </span>
      </Dropdown>
    </div>
  );
};

export default UserMenu; 