import React from 'react';
import { Modal, Button, Typography, Space, Divider } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface RegistrationLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onRetry: () => void;
  nextAvailableTime: Date;
  lastRegistrationTime: Date;
  remainingTime: number;
}

const RegistrationLimitModal: React.FC<RegistrationLimitModalProps> = ({
  visible,
  onClose,
  onRetry,
  nextAvailableTime,
  lastRegistrationTime,
  remainingTime
}) => {
  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: '18px' }} />
          <span>报名频率限制</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button 
          key="retry" 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={onRetry}
        >
          重新尝试
        </Button>
      ]}
      width={500}
      centered
      maskClosable={false}
      destroyOnClose
    >
      <div style={{ padding: '16px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <ExclamationCircleOutlined 
            style={{ 
              fontSize: '48px', 
              color: '#fa8c16',
              marginBottom: '16px',
              display: 'block'
            }} 
          />
          <Title level={4} style={{ margin: '0 0 8px 0', color: '#fa8c16' }}>
            报名过于频繁
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            为了确保系统稳定运行，每位用户3分钟内只能报名1场直播
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default RegistrationLimitModal;
