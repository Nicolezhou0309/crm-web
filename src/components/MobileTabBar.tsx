import type { FC } from 'react';
import { TabBar } from 'antd-mobile';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  HomeOutlined,
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  UserOutlined as ProfileOutlined,
  RocketOutlined,
} from '@ant-design/icons';

const MobileTabBar: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;

  const setRouteActive = (value: string) => {
    navigate(value);
  };

  const tabs = [
    {
      key: '/',
      title: '首页',
      icon: <HomeOutlined className="text-lg" />,
    },
    {
      key: '/followups',
      title: '跟进',
      icon: <UserOutlined className="text-lg" />,
    },
    {
      key: '/showings',
      title: '带看',
      icon: <EyeOutlined className="text-lg" />,
    },
    {
      key: '/deals',
      title: '成交',
      icon: <CheckCircleOutlined className="text-lg" />,
    },
    {
      key: '/xiaohongshu-test',
      title: '小红书',
      icon: <RocketOutlined className="text-lg" />,
    },
    {
      key: '/mobile-profile',
      title: '个人',
      icon: <ProfileOutlined className="text-lg" />,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      <TabBar 
        activeKey={pathname} 
        onChange={value => setRouteActive(value)}
        className="bg-white"
      >
        {tabs.map(item => (
          <TabBar.Item 
            key={item.key} 
            icon={item.icon} 
            title={item.title}
            className="text-gray-600"
          />
        ))}
      </TabBar>
    </div>
  );
};

export default MobileTabBar;