import React, { useState, useEffect } from 'react';
import Profile from './Profile';
import MobileProfile from './MobileProfile';

const ResponsiveProfile: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // 初始检查
    checkScreenSize();

    // 监听窗口大小变化
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // 根据屏幕尺寸渲染不同组件
  if (isMobile) {
    return <MobileProfile />;
  }

  // 桌面端使用原有组件
  return <Profile />;
};

export default ResponsiveProfile;
