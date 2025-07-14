import { Dropdown } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supaClient';
import { getUserPointsInfo, getCurrentProfileId } from '../api/pointsApi';

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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState<string>('加载中...');
  const [canAllocate, setCanAllocate] = useState<string>('加载中...');
  const [groupStatusList, setGroupStatusList] = useState<any[]>([]);
  const navigate = useNavigate();

  // 获取用户信息和头像
  const fetchUserAndAvatar = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    setLoading(false);
    if (data.user) {
      // 查询 users_profile.avatar_url
      const { data: profile } = await supabase
        .from('users_profile')
        .select('avatar_url')
        .eq('user_id', data.user.id)
        .single();
      // setAvatarUrl(profile?.avatar_url || data.user.user_metadata?.avatar_url || null); // This line is removed as per the new_code
      console.log('[UserMenu] fetchUserAndAvatar 执行，user:', data.user, 'avatarUrl:', profile?.avatar_url);
    } else {
      // setAvatarUrl(null); // This line is removed as per the new_code
      console.log('[UserMenu] fetchUserAndAvatar 执行，未获取到 user');
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

  useEffect(() => {
    if (user) {
      getCurrentProfileId().then(setProfileId);
    }
  }, [user]);

  useEffect(() => {
    if (profileId) {
      loadUserPoints(profileId);
    }
  }, [profileId]);

  const loadUserPoints = async (id: number) => {
    try {
      const data = await getUserPointsInfo(id);
      setUserPoints(data.wallet.total_points || 0);
    } catch (err) {
      console.error('获取用户积分失败:', err);
    }
  };

  // 悬浮时获取销售组和发放状态
  const fetchGroupAndStatus = async () => {
    if (!profileId) {
      setGroupName('未获取到用户ID');
      setCanAllocate('未知');
      setGroupStatusList([]);
      console.log('profileId 未获取到');
      return;
    }
    setGroupName('加载中...');
    setCanAllocate('加载中...');
    setGroupStatusList([]);
    try {
      const { data, error } = await supabase.rpc('get_user_allocation_status_multi', {
        p_user_id: profileId,
        p_source: '抖音', // 可根据实际业务调整
        p_leadtype: '意向客户',
        p_community: '浦江公园社区'
      });
      console.log('get_user_allocation_status_multi', data, error);
      if (error) {
        setGroupName('获取失败');
        setCanAllocate('未知');
        setGroupStatusList([]);
        return;
      }
      if (Array.isArray(data)) {
        setGroupStatusList(data);
        // 兼容原有单组逻辑，取第一个组
        setGroupName(data[0]?.groupname || '无');
        setCanAllocate(data[0]?.can_allocate === true ? '可发放' : (Array.isArray(data[0]?.reason) ? data[0]?.reason.join('；') : (data[0]?.reason || '不可发放')));
      } else {
        setGroupStatusList([]);
        setGroupName('无');
        setCanAllocate('未知');
      }
    } catch (err) {
      setGroupName('获取失败');
      setCanAllocate('未知');
      setGroupStatusList([]);
      console.error('get_user_allocation_status_multi error', err);
    }
  };

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

  const tooltipContent = (
    <div style={{ minWidth: 200 }}>
      {groupStatusList.length === 0 ? (
        <>
          <div>销售组：{groupName}</div>
          <div>发放状态：{canAllocate}</div>
        </>
      ) : (
        <div>
          {groupStatusList.map((g, idx) => (
            <div key={idx} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 500 }}>{g.groupname || '无'}</div>
              <div style={{ color: g.can_allocate ? '#52c41a' : '#f5222d', fontSize: 13 }}>
                {g.can_allocate ? '可发放' : '不可发放'}
              </div>
              {Array.isArray(g.reason) && !g.can_allocate && (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {g.reason.map((r: string, i: number) => (
                    <li key={i} style={{ color: '#f5222d', fontSize: 12 }}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* 这里只渲染菜单和业务相关内容，不渲染头像 */}
      {/* 积分余额显示，无Tooltip */}
      <div 
        className="points-display" 
        onClick={(e) => {
          e.stopPropagation();
          navigate('/points');
        }}
        style={{ 
          cursor: 'pointer',
          borderRadius: 20,
          background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 8px rgba(82, 196, 26, 0.2)',
          transition: 'all 0.3s ease',
          border: 'none',
          color: '#fff',
        }}
        title="点击查看积分详情"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(82, 196, 26, 0.2)';
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500 }}>积分余额</span>
        <span style={{ fontSize: 16, fontWeight: 700 }}>
          {loading ? '...' : userPoints}
        </span>
      </div>
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