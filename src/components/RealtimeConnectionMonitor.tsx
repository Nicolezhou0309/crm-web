import React, { useState, useEffect } from 'react';
import { Card, Statistic, Badge, Button, Space, Tooltip } from 'antd';
import { WifiOutlined, DisconnectOutlined, ReloadOutlined } from '@ant-design/icons';
import { realtimeService } from '../services/RealtimeService';

/**
 * 实时连接监控组件
 * 显示当前WebSocket连接状态和数量
 */
const RealtimeConnectionMonitor: React.FC = () => {
  const [connectionInfo, setConnectionInfo] = useState({
    isConnected: false,
    subscriptionCount: 0,
    connectionCount: 0,
    hasSharedChannel: false
  });

  const [isVisible, setIsVisible] = useState(false);

  // 更新连接信息
  const updateConnectionInfo = () => {
    const info = realtimeService.getConnectionInfo();
    setConnectionInfo(info);
  };

  // 定期更新连接信息
  useEffect(() => {
    updateConnectionInfo();
    const interval = setInterval(updateConnectionInfo, 2000); // 每2秒更新一次
    
    return () => clearInterval(interval);
  }, []);

  // 重新连接
  const handleReconnect = () => {
    realtimeService.unsubscribeAll();
    setTimeout(() => {
      updateConnectionInfo();
    }, 1000);
  };

  // 获取连接状态颜色
  const getStatusColor = () => {
    if (!connectionInfo.isConnected) return 'red';
    if (connectionInfo.connectionCount > 10) return 'orange';
    return 'green';
  };

  // 获取连接状态文本
  const getStatusText = () => {
    if (!connectionInfo.isConnected) return '未连接';
    if (connectionInfo.connectionCount > 10) return '连接过多';
    return '正常';
  };

  if (!isVisible) {
    return (
      <Tooltip title="显示连接监控">
        <Button
          type="text"
          icon={<WifiOutlined />}
          onClick={() => setIsVisible(true)}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #d9d9d9',
            borderRadius: '50%',
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Card
      title={
        <Space>
          <Badge 
            status={connectionInfo.isConnected ? 'success' : 'error'} 
            text="实时连接监控"
          />
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleReconnect}
            title="重新连接"
          />
        </Space>
      }
      size="small"
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 280,
        zIndex: 1000,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #d9d9d9',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
      extra={
        <Button
          type="text"
          size="small"
          onClick={() => setIsVisible(false)}
        >
          ×
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Statistic
          title="连接状态"
          value={getStatusText()}
          valueStyle={{ color: getStatusColor() }}
          prefix={connectionInfo.isConnected ? <WifiOutlined /> : <DisconnectOutlined />}
        />
        
        <Statistic
          title="订阅数量"
          value={connectionInfo.subscriptionCount}
          valueStyle={{ 
            color: connectionInfo.subscriptionCount > 5 ? '#fa8c16' : '#52c41a' 
          }}
        />
        
        <Statistic
          title="连接数量"
          value={connectionInfo.connectionCount}
          valueStyle={{ 
            color: connectionInfo.connectionCount > 10 ? '#ff4d4f' : '#52c41a' 
          }}
        />
        
        <Statistic
          title="共享连接"
          value={connectionInfo.hasSharedChannel ? '已启用' : '未启用'}
          valueStyle={{ 
            color: connectionInfo.hasSharedChannel ? '#52c41a' : '#fa8c16' 
          }}
        />
        
        {connectionInfo.connectionCount > 10 && (
          <div style={{ 
            padding: '8px 12px', 
            background: '#fff2e8', 
            border: '1px solid #ffd591',
            borderRadius: '6px',
            fontSize: '12px',
            color: '#d46b08'
          }}>
            ⚠️ 连接数过多，建议检查是否有重复连接
          </div>
        )}
      </Space>
    </Card>
  );
};

export default RealtimeConnectionMonitor;
