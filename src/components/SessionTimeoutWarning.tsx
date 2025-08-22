import React, { useState, useEffect } from 'react';
import { Modal, Button, Progress, Typography, Space } from 'antd';
import { ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface SessionTimeoutWarningProps {
  isVisible: boolean;
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  isVisible,
  timeRemaining,
  onExtend,
  onLogout
}) => {
  const [countdown, setCountdown] = useState(timeRemaining);
  const [isExtending, setIsExtending] = useState(false);

  // 倒计时
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          onLogout();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, onLogout]);

  // 重置倒计时
  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      await onExtend();
    } finally {
      setIsExtending(false);
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progressPercent = ((timeRemaining - countdown) / timeRemaining) * 100;

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>会话即将过期</span>
        </Space>
      }
      open={isVisible}
      footer={null}
      closable={false}
      maskClosable={false}
      width={400}
      centered
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <Title level={4} style={{ marginBottom: 16 }}>
          您的会话将在 {formatTime(countdown)} 后过期
        </Title>
        
        <div style={{ marginBottom: 20 }}>
          <Progress
            percent={progressPercent}
            status="exception"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#ff4d4f',
            }}
            showInfo={false}
          />
        </div>

        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          为了您的账户安全，系统将在无操作30分钟后自动登出。
          您可以点击"继续使用"来延长会话时间。
        </Text>

        <Space size="middle">
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={isExtending}
            onClick={handleExtend}
            size="large"
          >
            继续使用
          </Button>
          <Button
            onClick={onLogout}
            size="large"
          >
            立即登出
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default SessionTimeoutWarning; 