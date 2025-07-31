import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Text } = Typography;

const VisibilityDebug: React.FC = () => {
  const [isVisible, setIsVisible] = React.useState(() => {
    if (typeof document !== 'undefined') {
      return document.visibilityState === 'visible';
    }
    return true;
  });

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      console.log('👁️ [VisibilityDebug] 可见性变化:', {
        isVisible: visible,
        visibilityState: document.visibilityState,
        timestamp: new Date().toISOString()
      });
      setIsVisible(visible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    console.log('👁️ [VisibilityDebug] 初始化:', {
      isVisible,
      visibilityState: document.visibilityState,
      timestamp: new Date().toISOString()
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isVisible]);

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>页面可见性调试</Title>
      <Card>
        <Text strong>当前状态: </Text>
        <Text type={isVisible ? "success" : "warning"}>
          {isVisible ? "页面可见" : "页面不可见"}
        </Text>
        <br />
        <Text strong>document.visibilityState: </Text>
        <Text>{document.visibilityState}</Text>
        <br />
        <Text strong>时间: </Text>
        <Text>{new Date().toLocaleTimeString()}</Text>
      </Card>
    </div>
  );
};

export default VisibilityDebug; 