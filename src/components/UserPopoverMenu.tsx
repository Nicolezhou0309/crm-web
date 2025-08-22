import React from 'react';
import { Menu } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const UserPopoverMenu: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleClick = async (e: any) => {
    if (e.key === 'profile') {
      navigate('/profile');
    } else if (e.key === 'logout') {
      await logout(navigate);
    }
  };

  return (
    <Menu
      onClick={handleClick}
      items={[
        { key: 'profile', label: '个人中心' },
        { type: 'divider' },
        { key: 'logout', label: '退出登录' },
      ]}
      style={{ minWidth: 120 }}
    />
  );
};

export default UserPopoverMenu; 