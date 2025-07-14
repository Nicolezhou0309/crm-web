import React, { useState } from 'react';
import { Card, Tabs, Button, message } from 'antd';
import { AchievementSystem } from '../components/AchievementSystem';
import { AchievementIconManager } from '../components/AchievementIconManager';
import { PermissionGate } from '../components/PermissionGate';

const { TabPane } = Tabs;

export const AchievementManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleIconUpdate = () => {
    setRefreshKey(prev => prev + 1);
    message.success('图标已更新，成就系统将刷新');
  };

  return (
    <div style={{ padding: '20px' }}>
      <Card title="成就系统管理" style={{ marginBottom: '20px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="成就概览" key="overview">
            <AchievementSystem key={refreshKey} />
          </TabPane>
          
          <TabPane tab="图标管理" key="icons">
            <PermissionGate permissions={['admin']}>
              <AchievementIconManager onIconUpdate={handleIconUpdate} />
            </PermissionGate>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
}; 