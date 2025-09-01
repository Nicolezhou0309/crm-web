import React, { useState, useEffect } from 'react';
import { Card, Button, message, Space, Typography, Alert } from 'antd';
import { useRealtimeNotifications } from '../hooks/useRealtimeNotifications';
import { useRealtimeConcurrencyControl } from '../hooks/useRealtimeConcurrencyControl';

const { Title, Text } = Typography;

const RealtimeTest: React.FC = () => {
  const [testStatus, setTestStatus] = useState<string>('准备测试');
  const [connectionStatus, setConnectionStatus] = useState<string>('未连接');
  
  // 使用realtime hooks
  const notifications = useRealtimeNotifications();
  const concurrencyControl = useRealtimeConcurrencyControl();

  useEffect(() => {
    // 检查连接状态
    if (concurrencyControl.isConnected) {
      setConnectionStatus('已连接');
      setTestStatus('realtime功能正常');
    } else {
      setConnectionStatus('未连接');
      setTestStatus('realtime功能异常');
    }
  }, [concurrencyControl.isConnected]);

  const testRealtimeConnection = async () => {
    try {
      setTestStatus('测试中...');
      
      // 模拟一个简单的realtime测试
      setTimeout(() => {
        if (concurrencyControl.isConnected) {
          setTestStatus('✅ realtime功能正常工作');
          message.success('realtime连接测试成功！');
        } else {
          setTestStatus('❌ realtime功能异常');
          message.error('realtime连接测试失败！');
        }
      }, 2000);
      
    } catch (error) {
      setTestStatus('❌ 测试失败');
      message.error('测试过程中发生错误');
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>Realtime 功能测试页面</Title>
      
      <Alert
        message="Realtime 功能状态"
        description={`当前状态: ${testStatus}`}
        type={testStatus.includes('正常') ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card title="连接状态" size="small">
          <Space direction="vertical">
            <Text>Realtime 连接: <Text code>{connectionStatus}</Text></Text>
            <Text>通知系统: <Text code>{notifications.loading ? '加载中' : '就绪'}</Text></Text>
            <Text>并发控制: <Text code>{concurrencyControl.isConnected ? '已连接' : '未连接'}</Text></Text>
          </Space>
        </Card>

        <Card title="通知系统" size="small">
          <Space direction="vertical">
            <Text>未读通知数量: <Text code>{notifications.unreadCount}</Text></Text>
            <Text>总通知数量: <Text code>{notifications.notifications.length}</Text></Text>
            <Text>最后更新: <Text code>{notifications.lastUpdate ? new Date(notifications.lastUpdate).toLocaleString() : '无'}</Text></Text>
          </Space>
        </Card>

        <Card title="并发控制" size="small">
          <Space direction="vertical">
            <Text>编辑锁定数量: <Text code>{Object.keys(concurrencyControl.editLocks).length}</Text></Text>
            <Text>时间段锁定数量: <Text code>{Object.keys(concurrencyControl.timeSlotLocks).length}</Text></Text>
            <Text>当前用户锁定: <Text code>{concurrencyControl.currentUserLocks.size}</Text></Text>
          </Space>
        </Card>

        <Card title="测试操作" size="small">
          <Space>
            <Button type="primary" onClick={testRealtimeConnection}>
              测试 Realtime 连接
            </Button>
            <Button onClick={() => notifications.loadNotifications(1)}>
              重新加载通知
            </Button>
          </Space>
        </Card>
      </Space>

      <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
        <Title level={4}>使用说明</Title>
        <Text>
          此页面用于测试项目的realtime功能是否正常工作。包括：
        </Text>
        <ul>
          <li>通知系统的实时更新</li>
          <li>并发控制的实时状态同步</li>
          <li>数据库连接的实时监听</li>
        </ul>
        <Text>
          如果所有状态都显示正常，说明realtime功能已经成功恢复。
        </Text>
      </div>
    </div>
  );
};

export default RealtimeTest;
