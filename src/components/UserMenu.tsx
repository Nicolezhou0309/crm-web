import { Dropdown } from 'antd';
import { useState, useEffect } from 'react';
import { supabase } from '../supaClient';

export function useUserMenuAvatarUrl() {
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase
          .from('users_profile')
          .select('avatar_url')
          .eq('user_id', data.user.id)
          .single();
        setAvatarUrl(profile?.avatar_url || undefined);
      } else {
        setAvatarUrl(undefined);
      }
    })();
  }, []);
  return avatarUrl;
}

const UserMenu = () => {
  const [, setUser] = useState<any>(null);

  // 获取用户信息和头像
  const fetchUserAndAvatar = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    if (data.user) {
      // 查询 users_profile.avatar_url
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', data.user.id)
        .single();
    }
  };

  useEffect(() => {
    fetchUserAndAvatar();
  }, []);

  // 监听全局刷新口令
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'avatar_refresh_token') {
        fetchUserAndAvatar();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const handleAvatarRefresh = () => {
      fetchUserAndAvatar();
    };
    window.addEventListener('avatar_refresh_token', handleAvatarRefresh);
    return () => window.removeEventListener('avatar_refresh_token', handleAvatarRefresh);
  }, []);

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