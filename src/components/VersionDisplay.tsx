import React, { useState } from 'react';
import { Tooltip, Tag, Space } from 'antd';
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { cacheManager } from '../utils/cacheManager';

interface VersionDisplayProps {
  /** 显示样式 */
  style?: React.CSSProperties;
  /** 是否显示为标签形式 */
  asTag?: boolean;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否显示刷新按钮 */
  showRefreshButton?: boolean;
  /** 刷新按钮点击回调 */
  onRefresh?: () => void;
}

/**
 * 版本号显示组件
 * 显示当前应用版本和相关信息
 */
const VersionDisplay: React.FC<VersionDisplayProps> = ({
  style,
  asTag = false,
  showDetails = false,
  showRefreshButton = false,
  onRefresh
}) => {
  const [hovered, setHovered] = useState(false);

  const currentVersion = cacheManager.getCurrentVersion();
  const storedVersionInfo = cacheManager.getStoredVersionInfo();
  const hasUpdate = cacheManager.checkForUpdates();

  const versionText = `v${currentVersion}`;
  
  const tooltipContent = (
    <div style={{ maxWidth: 300 }}>
      <div><strong>当前版本：</strong>{currentVersion}</div>
      <div><strong>存储版本：</strong>{storedVersionInfo?.version || '未知'}</div>
      {storedVersionInfo?.timestamp && (
        <div><strong>最后更新：</strong>{new Date(storedVersionInfo.timestamp).toLocaleString()}</div>
      )}
      {hasUpdate && (
        <div style={{ color: '#faad14', marginTop: 8 }}>
          <InfoCircleOutlined /> 检测到版本更新
        </div>
      )}
    </div>
  );

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      cacheManager.forceRefreshAll();
    }
  };

  if (asTag) {
    return (
      <Space>
        <Tooltip title={tooltipContent} placement="top">
          <Tag 
            color={hasUpdate ? 'orange' : 'default'}
            style={{ cursor: 'pointer', ...style }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {versionText}
            {hasUpdate && <InfoCircleOutlined style={{ marginLeft: 4 }} />}
          </Tag>
        </Tooltip>
        {showRefreshButton && (
          <Tooltip title="刷新缓存">
            <Tag 
              color="blue" 
              style={{ cursor: 'pointer' }}
              onClick={handleRefresh}
            >
              <ReloadOutlined />
            </Tag>
          </Tooltip>
        )}
      </Space>
    );
  }

  if (showDetails) {
    return (
      <div style={{ ...style }}>
        <Tooltip title={tooltipContent} placement="top">
          <div 
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <span>{versionText}</span>
            {hasUpdate && <InfoCircleOutlined style={{ color: '#faad14' }} />}
            {showRefreshButton && (
              <ReloadOutlined 
                style={{ 
                  cursor: 'pointer',
                  color: hovered ? '#1890ff' : '#bbb',
                  transition: 'color 0.3s'
                }}
                onClick={handleRefresh}
              />
            )}
          </div>
        </Tooltip>
      </div>
    );
  }

  return (
    <Tooltip title={tooltipContent} placement="top">
      <div 
        style={{ 
          cursor: 'pointer',
          ...style 
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {versionText}
        {hasUpdate && <InfoCircleOutlined style={{ marginLeft: 4, color: '#faad14' }} />}
      </div>
    </Tooltip>
  );
};

export default VersionDisplay;
