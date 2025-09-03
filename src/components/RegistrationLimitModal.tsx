import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Space, Divider } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import CountdownTimer from './CountdownTimer';

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
  const [canRetry, setCanRetry] = useState(false);

  // 监听倒计时结束
  const handleCountdownExpire = () => {
    setCanRetry(true);
  };

  // 格式化时间显示
  const formatTime = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // 计算剩余时间（秒）
  const getRemainingSeconds = () => {
    const now = new Date().getTime();
    const target = nextAvailableTime.getTime();
    return Math.max(0, Math.floor((target - now) / 1000));
  };

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
          disabled={!canRetry}
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
        {/* 主要提示信息 */}
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

        <Divider />

        {/* 详细信息 */}
        <div style={{ marginBottom: '24px' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* 上次报名时间 */}
            <div>
              <Text strong>上次报名时间：</Text>
              <br />
              <Text code style={{ fontSize: '13px' }}>
                {formatTime(lastRegistrationTime)}
              </Text>
            </div>

            {/* 下次可报名时间 */}
            <div>
              <Text strong>下次可报名时间：</Text>
              <br />
              <Text code style={{ fontSize: '13px' }}>
                {formatTime(nextAvailableTime)}
              </Text>
            </div>

            {/* 倒计时显示 */}
            <div style={{ 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f', 
              borderRadius: '6px', 
              padding: '16px',
              textAlign: 'center'
            }}>
              <Space direction="vertical" size="small">
                <Text strong style={{ color: '#52c41a' }}>
                  <ClockCircleOutlined style={{ marginRight: '4px' }} />
                  距离下次可报名还有：
                </Text>
                <div style={{ fontSize: '18px', fontWeight: '600', color: '#52c41a' }}>
                  <CountdownTimer
                    targetTime={nextAvailableTime}
                    onExpire={handleCountdownExpire}
                    format="full"
                    showIcon={false}
                    style={{ fontSize: '18px', fontWeight: '600' }}
                  />
                </div>
              </Space>
            </div>
          </Space>
        </div>

        <Divider />

        {/* 说明文字 */}
        <div style={{ background: '#f0f9ff', border: '1px solid #91d5ff', borderRadius: '6px', padding: '12px' }}>
          <Paragraph style={{ margin: 0, fontSize: '13px', color: '#1890ff' }}>
            <Text strong>💡 温馨提示：</Text>
            <br />
            • 此限制是为了防止恶意刷单和确保系统稳定
            <br />
            • 请耐心等待倒计时结束后再进行报名
            <br />
            • 倒计时结束后，您可以点击"重新尝试"按钮继续报名
          </Paragraph>
        </div>
      </div>
    </Modal>
  );
};

export default RegistrationLimitModal;
