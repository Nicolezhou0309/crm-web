import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Divider, Tag, Alert } from 'antd';
import { ReloadOutlined, DeleteOutlined, InfoCircleOutlined, BugOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const CacheDebugPage: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<any>({});
  const [sessionInfo, setSessionInfo] = useState<any>({});

  const updateCacheInfo = () => {
    const cacheKeys = [
      'user_cache',
      'profile_cache', 
      'user_cache_timestamp',
      'last_activity_timestamp',
      'session_id'
    ];

    const info: any = {};
    cacheKeys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        try {
          info[key] = JSON.parse(value);
        } catch {
          info[key] = value;
        }
      } else {
        info[key] = null;
      }
    });

    setCacheInfo(info);

    // 计算会话信息
    const lastActivity = localStorage.getItem('last_activity_timestamp');
    const sessionTimeout = 30 * 60 * 1000; // 30分钟
    const warningThreshold = 5 * 60 * 1000; // 5分钟

    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      const timeRemaining = Math.max(0, sessionTimeout - timeSinceLastActivity);
      const isExpired = timeSinceLastActivity > sessionTimeout;
      const shouldWarn = timeRemaining <= warningThreshold && timeRemaining > 0;

      setSessionInfo({
        lastActivity: new Date(parseInt(lastActivity)).toLocaleString(),
        timeSinceLastActivity: Math.floor(timeSinceLastActivity / 1000),
        timeRemaining: Math.floor(timeRemaining / 1000),
        isExpired,
        shouldWarn,
        sessionTimeout: Math.floor(sessionTimeout / 1000),
        warningThreshold: Math.floor(warningThreshold / 1000)
      });
    } else {
      setSessionInfo({
        lastActivity: '无',
        timeSinceLastActivity: 0,
        timeRemaining: 0,
        isExpired: true,
        shouldWarn: false
      });
    }
  };

  useEffect(() => {
    updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  const clearAllCache = () => {
    Object.keys(cacheInfo).forEach(key => {
      localStorage.removeItem(key);
    });
    updateCacheInfo();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCacheSize = () => {
    let totalSize = 0;
    Object.keys(cacheInfo).forEach(key => {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += new Blob([value]).size;
      }
    });
    return formatBytes(totalSize);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <BugOutlined style={{ marginRight: 8 }} />
          缓存调试工具
        </Title>
        <Text type="secondary">
          用于调试用户缓存和会话状态的管理工具
        </Text>
      </div>

      <Alert
        message="开发工具"
        description="此页面仅用于开发和调试目的，生产环境中应谨慎使用。"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* 会话状态卡片 */}
        <Card
          title={
            <Space>
              <InfoCircleOutlined />
              <span>会话状态</span>
            </Space>
          }
          extra={
            <Button 
              icon={<ReloadOutlined />} 
              size="small" 
              onClick={updateCacheInfo}
            >
              刷新
            </Button>
          }
        >
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div>
              <Text strong>最后活动:</Text> {sessionInfo.lastActivity}
            </div>
            <div>
              <Text strong>剩余时间:</Text> 
              <Tag color={sessionInfo.isExpired ? 'red' : sessionInfo.shouldWarn ? 'orange' : 'green'}>
                {sessionInfo.timeRemaining}秒
              </Tag>
            </div>
            <div>
              <Text strong>状态:</Text> 
              <Tag color={sessionInfo.isExpired ? 'red' : sessionInfo.shouldWarn ? 'orange' : 'green'}>
                {sessionInfo.isExpired ? '已过期' : sessionInfo.shouldWarn ? '即将过期' : '正常'}
              </Tag>
            </div>
            <div>
              <Text strong>会话超时:</Text> {sessionInfo.sessionTimeout}秒
            </div>
            <div>
              <Text strong>警告阈值:</Text> {sessionInfo.warningThreshold}秒
            </div>
          </Space>
        </Card>

        {/* 缓存信息卡片 */}
        <Card
          title={
            <Space>
              <InfoCircleOutlined />
              <span>缓存信息</span>
            </Space>
          }
          extra={
            <Button 
              icon={<DeleteOutlined />} 
              size="small" 
              danger 
              onClick={clearAllCache}
            >
              清除缓存
            </Button>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Text strong>总大小:</Text> {getCacheSize()}
          </div>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {Object.entries(cacheInfo).map(([key, value]) => (
              <div key={key}>
                <Text strong>{key}:</Text> 
                <Tag color={value ? 'blue' : 'default'}>
                  {value ? '已缓存' : '未缓存'}
                </Tag>
                {value && (
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {typeof value === 'object' ? JSON.stringify(value).substring(0, 50) + '...' : String(value as any).substring(0, 50)}
                  </Text>
                )}
              </div>
            ))}
          </Space>
        </Card>
      </div>

      {/* 详细缓存内容 */}
      <Card
        title="详细缓存内容"
        style={{ marginTop: 24 }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {Object.entries(cacheInfo).map(([key, value]) => (
            <div key={key}>
              <Title level={5}>{key}</Title>
              <div style={{ 
                backgroundColor: '#f5f5f5', 
                padding: 12, 
                borderRadius: 4,
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: 200,
                overflow: 'auto'
              }}>
                {`${value ? JSON.stringify(value as any, null, 2) : 'null'}`}
              </div>
            </div>
          ))}
        </Space>
      </Card>

      {/* 操作按钮 */}
      <Card style={{ marginTop: 24 }}>
        <Space>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={updateCacheInfo}
          >
            刷新数据
          </Button>
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            onClick={clearAllCache}
          >
            清除所有缓存
          </Button>
          <Button 
            onClick={() => {
              localStorage.setItem('last_activity_timestamp', Date.now().toString());
              updateCacheInfo();
            }}
          >
            更新活动时间
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default CacheDebugPage; 