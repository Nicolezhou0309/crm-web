import React from 'react';
import MobileFollowups from './mobile';

// 移动端组件的包装器，用于更稳定的动态导入
const MobileFollowupsWrapper: React.FC = () => {
  return <MobileFollowups />;
};

export default MobileFollowupsWrapper;
