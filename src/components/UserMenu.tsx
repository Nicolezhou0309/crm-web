import { Dropdown, Avatar, Tooltip } from 'antd';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supaClient';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { getUserPointsInfo, getCurrentProfileId } from '../api/pointsApi';
import { allocationApi } from '../utils/allocationApi';

const UserMenu = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState<string>('加载中...');
  const [canAllocate, setCanAllocate] = useState<string>('加载中...');
  const [groupStatusList, setGroupStatusList] = useState<any[]>([]);
  const { isSuperAdmin, isSystemAdmin } = useRolePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
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
    <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* 积分余额显示，无Tooltip */}
      <div 
        className="points-display" 
        onClick={(e) => {
          e.stopPropagation();
          navigate('/points');
        }}
        style={{ cursor: 'pointer' }}
        title="点击查看积分详情"
      >
        <span className="points-label">积分余额</span>
        <span className="points-value">
          {loading ? '...' : userPoints}
        </span>
      </div>
      {/* 用户头像和名称Dropdown */}
      <Dropdown menu={menuProps} placement="bottomRight">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <Avatar size="small" style={{ backgroundColor: isSuperAdmin ? '#f5222d' : isSystemAdmin ? '#1890ff' : '#52c41a' }}>
            {user?.user_metadata?.name?.[0] || user?.email?.[0] || 'U'}
          </Avatar>
          <span style={{ color: '#222', fontSize: '14px' }}>
            {loading ? '加载中...' : (user?.user_metadata?.name || user?.email || '未登录')}
          </span>
        </span>
      </Dropdown>
    </span>
  );
};

export default UserMenu; 