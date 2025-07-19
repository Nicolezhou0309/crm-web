import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Divider, Tag } from 'antd';
import { ReloadOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface CacheDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const CacheDebugPanel: React.FC<CacheDebugPanelProps> = ({ isVisible, onClose }) => {
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
    if (isVisible) {
      updateCacheInfo();
      const interval = setInterval(updateCacheInfo, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

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

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      width: 400,
      maxHeight: '80vh',
      overflowY: 'auto',
      zIndex: 1000,
      backgroundColor: '#fff',
      borderRadius: 8,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      border: '1px solid #d9d9d9'
    }}>
      <Card
        title={
          <Space>
            <InfoCircleOutlined />
            <span>缓存调试面板</span>
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              size="small" 
              onClick={updateCacheInfo}
            >
              刷新
            </Button>
            <Button 
              icon={<DeleteOutlined />} 
              size="small" 
              danger 
              onClick={clearAllCache}
            >
              清除
            </Button>
            <Button size="small" onClick={onClose}>
              关闭
            </Button>
          </Space>
        }
        size="small"
      >
        <div style={{ fontSize: '12px' }}>
          {/* 会话状态 */}
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>会话状态</Title>
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
            </Space>
          </div>

          <Divider />

          {/* 缓存信息 */}
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>缓存信息</Title>
            <div style={{ marginBottom: 8 }}>
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
          </div>

          <Divider />

          {/* 操作按钮 */}
          <div>
            <Title level={5}>操作</Title>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Button 
                size="small" 
                block 
                onClick={() => {
                  localStorage.setItem('last_activity_timestamp', Date.now().toString());
                  updateCacheInfo();
                }}
              >
                更新活动时间
              </Button>
              <Button 
                size="small" 
                block 
                onClick={() => {
                  localStorage.removeItem('last_activity_timestamp');
                  updateCacheInfo();
                }}
              >
                清除活动时间
              </Button>
            </Space>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CacheDebugPanel; 