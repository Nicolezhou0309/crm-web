import { useEffect, useState, useCallback } from 'react';
import { message, Modal } from 'antd';
import { cacheManager } from '../utils/cacheManager';

interface VersionInfo {
  current: string;
  stored: string | null;
  hasUpdate: boolean;
  lastUpdateTime: string | null;
}

/**
 * 版本检查Hook
 * 用于检测应用版本更新并提示用户刷新缓存
 */
export const useVersionCheck = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    current: cacheManager.getCurrentVersion(),
    stored: null,
    hasUpdate: false,
    lastUpdateTime: null
  });

  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // 检查版本更新
  const checkVersion = useCallback(() => {
    const current = cacheManager.getCurrentVersion();
    const storedVersionInfo = cacheManager.getStoredVersionInfo();
    const stored = storedVersionInfo?.version || null;
    const hasUpdate = cacheManager.checkForUpdates();
    const lastUpdateTime = storedVersionInfo?.timestamp 
      ? new Date(storedVersionInfo.timestamp).toLocaleString()
      : null;

    setVersionInfo({
      current,
      stored,
      hasUpdate,
      lastUpdateTime
    });

    return hasUpdate;
  }, []);

  // 强制刷新缓存
  const forceRefresh = useCallback(() => {
    setShowUpdateModal(false);
    message.loading('正在刷新缓存...', 0);
    
    setTimeout(() => {
      cacheManager.forceRefreshAll();
    }, 1000);
  }, []);

  // 忽略更新
  const ignoreUpdate = useCallback(() => {
    setShowUpdateModal(false);
    // 可以选择设置一个标记，在一定时间内不再提示
    localStorage.setItem('ignore_version_update', Date.now().toString());
  }, []);

  // 定期检查版本更新
  useEffect(() => {
    // 立即检查一次
    const hasUpdate = checkVersion();

    // 检查是否在忽略期内
    const ignoreTime = localStorage.getItem('ignore_version_update');
    const ignoreDuration = 24 * 60 * 60 * 1000; // 24小时忽略期
    
    if (hasUpdate && (!ignoreTime || Date.now() - parseInt(ignoreTime) > ignoreDuration)) {
      setShowUpdateModal(true);
    }

    // 每5分钟检查一次版本更新
    const interval = setInterval(() => {
      checkVersion();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkVersion]);

  // 监听页面可见性变化，当页面重新获得焦点时检查更新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkVersion]);

  return {
    versionInfo,
    showUpdateModal,
    checkVersion,
    forceRefresh,
    ignoreUpdate,
    setShowUpdateModal
  };
};

/**
 * 版本更新提示组件
 */
export const VersionUpdateModal: React.FC<{
  visible: boolean;
  versionInfo: VersionInfo;
  onRefresh: () => void;
  onIgnore: () => void;
  onCancel: () => void;
}> = ({ visible, versionInfo, onRefresh, onIgnore, onCancel }) => {
  return (
    <Modal
      title="🔄 检测到应用更新"
      open={visible}
      onOk={onRefresh}
      onCancel={onCancel}
      okText="立即更新"
      cancelText="稍后提醒"
      width={500}
      okButtonProps={{ type: 'primary' }}
    >
      <div style={{ marginBottom: 16 }}>
        <p>检测到应用有新版本，建议刷新缓存以获得最新功能：</p>
        
        <div style={{ 
          background: '#f5f5f5', 
          padding: 12, 
          borderRadius: 6,
          marginBottom: 16 
        }}>
          <p><strong>当前版本：</strong>{versionInfo.current}</p>
          <p><strong>存储版本：</strong>{versionInfo.stored || '未知'}</p>
          {versionInfo.lastUpdateTime && (
            <p><strong>最后更新：</strong>{versionInfo.lastUpdateTime}</p>
          )}
        </div>

        <p>更新后将清除所有本地缓存，页面会自动刷新。</p>
      </div>
    </Modal>
  );
};
