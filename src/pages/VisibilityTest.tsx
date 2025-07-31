import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Typography, Alert } from 'antd';

const { Title, Text } = Typography;

const VisibilityTest: React.FC = () => {
  // 简化可见性状态 - 始终认为页面可见
  const isVisible = true;
  const timeSinceLastChange = 0;
  const [visibilityHistory, setVisibilityHistory] = useState<Array<{
    timestamp: string;
    isVisible: boolean;
    action: string;
  }>>([]);

  useEffect(() => {
    setVisibilityHistory(prev => [...prev, {
      timestamp: new Date().toISOString(),
      isVisible,
      action: '状态变化'
    }]);
  }, [isVisible]);

  const addManualRecord = (action: string) => {
    setVisibilityHistory(prev => [...prev, {
      timestamp: new Date().toISOString(),
      isVisible,
      action
    }]);
  };

  const clearHistory = () => {
    setVisibilityHistory([]);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>页面可见性测试</Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 当前状态 */}
        <Card title="当前状态">
          <Space direction="vertical" size="middle">
            <Alert
              message={isVisible ? "页面可见" : "页面不可见"}
              type={isVisible ? "success" : "warning"}
              showIcon
            />
            <Text>距离上次变化: {Math.round(timeSinceLastChange / 1000)}秒</Text>
            <Text>document.visibilityState: {document.visibilityState}</Text>
          </Space>
        </Card>

        {/* 测试按钮 */}
        <Card title="测试操作">
          <Space>
            <Button onClick={() => addManualRecord('手动记录')}>
              记录当前状态
            </Button>
            <Button onClick={clearHistory} danger>
              清除历史
            </Button>
            <Button onClick={() => window.open('about:blank', '_blank')}>
              打开新标签页
            </Button>
          </Space>
        </Card>

        {/* 历史记录 */}
        <Card title="可见性变化历史">
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {visibilityHistory.length === 0 ? (
              <Text type="secondary">暂无历史记录</Text>
            ) : (
              visibilityHistory.map((record, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    margin: '4px 0',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    backgroundColor: record.isVisible ? '#f6ffed' : '#fff2e8'
                  }}
                >
                  <Text strong>{record.action}</Text>
                  <br />
                  <Text type="secondary">
                    时间: {new Date(record.timestamp).toLocaleTimeString()}
                  </Text>
                  <br />
                  <Text type={record.isVisible ? "success" : "warning"}>
                    状态: {record.isVisible ? "可见" : "不可见"}
                  </Text>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* 使用说明 */}
        <Card title="使用说明">
          <Space direction="vertical">
            <Text>1. 切换浏览器标签页来测试可见性变化</Text>
            <Text>2. 最小化浏览器窗口来测试可见性变化</Text>
            <Text>3. 观察控制台日志了解详细变化</Text>
            <Text>4. 使用"记录当前状态"按钮手动记录</Text>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default VisibilityTest; 