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

  // 日志记录函数
  const logCountdownEvent = (event: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🕐 [SessionTimeoutWarning] ${event}`, {
        timestamp: new Date().toISOString(),
        timeRemaining: timeRemaining,
        countdown: countdown,
        isVisible: isVisible,
        ...data
      });
    }
  };

  // 倒计时
  useEffect(() => {
    if (!isVisible) {
      logCountdownEvent('倒计时停止 - 组件不可见');
      return;
    }

    logCountdownEvent('倒计时开始', { 
      initialTime: timeRemaining,
      warningThreshold: '5分钟'
    });

    const interval = setInterval(() => {
      setCountdown(prev => {
        const newTime = prev - 1000;
        
        // 记录关键时间点的日志
        if (newTime <= 30000 && newTime > 25000) { // 30秒警告
          logCountdownEvent('30秒警告', { remainingTime: newTime });
        } else if (newTime <= 10000 && newTime > 5000) { // 10秒警告
          logCountdownEvent('10秒警告', { remainingTime: newTime });
        } else if (newTime <= 5000 && newTime > 0) { // 5秒警告
          logCountdownEvent('5秒警告', { remainingTime: newTime });
        }
        
        if (newTime <= 0) {
          logCountdownEvent('倒计时结束 - 自动登出', { 
            finalTime: newTime,
            action: 'logout'
          });
          onLogout();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => {
      logCountdownEvent('倒计时清理 - 组件卸载或重新渲染');
      clearInterval(interval);
    };
  }, [isVisible, onLogout, timeRemaining]);

  // 重置倒计时
  useEffect(() => {
    logCountdownEvent('倒计时重置', { 
      oldTime: countdown,
      newTime: timeRemaining,
      reason: 'timeRemaining prop changed'
    });
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  const handleExtend = async () => {
    logCountdownEvent('用户点击延长会话', { 
      currentTime: countdown,
      action: 'extend_session'
    });
    
    setIsExtending(true);
    try {
      await onExtend();
      logCountdownEvent('会话延长成功', { 
        action: 'extend_success'
      });
    } catch (error) {
      logCountdownEvent('会话延长失败', { 
        error: error,
        action: 'extend_failed'
      });
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = () => {
    logCountdownEvent('用户主动登出', { 
      currentTime: countdown,
      action: 'manual_logout'
    });
    onLogout();
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
            onClick={handleLogout}
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