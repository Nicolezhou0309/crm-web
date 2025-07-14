import React, { createContext, useState, useCallback } from 'react';
import { supabase } from '../supaClient';

export const UserContext = createContext({
  avatarUrl: '',
  refreshAvatar: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  const refreshAvatar = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', userData.user.id)
        .single();
      console.log('[UserContext] 刷新头像，数据库 avatar_url:', profile?.avatar_url);
      setAvatarUrl(profile?.avatar_url || '');
    } else {
      console.log('[UserContext] 刷新头像，未获取到 user');
      setAvatarUrl('');
    }
  }, []);

  // 初始化时加载一次
  React.useEffect(() => {
    console.log('[UserContext] 初始化 useEffect');
    refreshAvatar();
  }, [refreshAvatar]);

  React.useEffect(() => {
    console.log('[UserContext] Provider 渲染，当前 avatarUrl:', avatarUrl);
  }, [avatarUrl]);

  return (
    <UserContext.Provider value={{ avatarUrl, refreshAvatar }}>
      {children}
    </UserContext.Provider>
  );
}; 