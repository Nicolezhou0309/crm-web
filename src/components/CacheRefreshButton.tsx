import React, { useState } from 'react';
import { Button, Modal, message, Space, Typography } from 'antd';
import { ReloadOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { cacheManager } from '../utils/cacheManager';

const { Text, Paragraph } = Typography;

interface CacheRefreshButtonProps {
  /** 按钮样式 */
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
  /** 按钮大小 */
  size?: 'small' | 'middle' | 'large';
  /** 是否显示为图标按钮 */
  iconOnly?: boolean;
  /** 自定义样式类名 */
  className?: string;
}

/**
 * 缓存刷新按钮组件
 * 提供手动清除所有缓存的功能
 */
const CacheRefreshButton: React.FC<CacheRefreshButtonProps> = ({
  type = 'default',
  size = 'middle',
  iconOnly = false,
  className
}) => {
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 显示确认对话框
      setModalVisible(true);
    } catch (error) {
      console.error('缓存刷新失败:', error);
      message.error('缓存刷新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmRefresh = () => {
    setModalVisible(false);
    
    // 显示刷新提示
    message.loading('正在刷新缓存...', 0);
    
    // 延迟执行刷新，让用户看到提示
    setTimeout(() => {
      cacheManager.forceRefreshAll();
    }, 1000);
  };

  const handleCancel = () => {
    setModalVisible(false);
  };

  const currentVersion = cacheManager.getCurrentVersion();
  const storedVersion = cacheManager.getStoredVersionInfo();

  return (
    <>
      <Button
        type={type}
        size={size}
        icon={<ReloadOutlined />}
        onClick={handleRefresh}
        loading={loading}
        className={className}
        title="刷新应用缓存"
      >
        {!iconOnly && '刷新缓存'}
      </Button>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#faad14' }} />
            <span>确认刷新缓存</span>
          </Space>
        }
        open={modalVisible}
        onOk={handleConfirmRefresh}
        onCancel={handleCancel}
        okText="确认刷新"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Paragraph>
            此操作将清除所有本地缓存数据，包括：
          </Paragraph>
          <ul style={{ marginLeft: 20, marginBottom: 16 }}>
            <li>用户信息缓存</li>
            <li>页面数据缓存</li>
            <li>地铁站点缓存</li>
            <li>频率控制缓存</li>
            <li>其他应用缓存</li>
          </ul>
          
          <Paragraph>
            清除后页面将自动刷新，您需要重新登录。
          </Paragraph>
        </div>

        <div style={{ 
          background: '#f5f5f5', 
          padding: 12, 
          borderRadius: 6,
          marginBottom: 16 
        }}>
          <Text strong>版本信息：</Text>
          <br />
          <Text>当前版本：{currentVersion}</Text>
          <br />
          <Text>存储版本：{storedVersion?.version || '未知'}</Text>
          <br />
          <Text type="secondary">
            最后更新：{storedVersion ? new Date(storedVersion.timestamp).toLocaleString() : '未知'}
          </Text>
        </div>

        <Text type="warning">
          ⚠️ 请确保您已保存所有重要数据，此操作不可撤销。
        </Text>
      </Modal>
    </>
  );
};

export default CacheRefreshButton;
