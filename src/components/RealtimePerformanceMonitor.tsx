import React, { useEffect, useState, useRef } from 'react';
import { Card, Statistic, Row, Col, Alert, Button, Space } from 'antd';
import { DashboardOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

interface PerformanceMetrics {
  handlerName: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  count: number;
  lastDuration: number;
}

/**
 * 实时性能监控组件
 * 用于监控和显示实时事件处理器的性能指标
 */
export const RealtimePerformanceMonitor: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 模拟性能数据收集（实际应用中应该从性能监控服务获取）
  const collectMetrics = () => {
    // 这里应该从实际的性能监控服务获取数据
    // 目前使用模拟数据
    const mockMetrics: PerformanceMetrics[] = [
      {
        handlerName: 'INSERT事件处理器',
        avgDuration: 45.2,
        maxDuration: 180.5,
        minDuration: 12.3,
        count: 156,
        lastDuration: 38.7
      },
      {
        handlerName: 'UPDATE事件处理器',
        avgDuration: 32.1,
        maxDuration: 95.2,
        minDuration: 8.9,
        count: 89,
        lastDuration: 28.4
      },
      {
        handlerName: 'DELETE事件处理器',
        avgDuration: 28.7,
        maxDuration: 67.8,
        minDuration: 5.2,
        count: 23,
        lastDuration: 31.2
      }
    ];
    
    setMetrics(mockMetrics);
  };

  useEffect(() => {
    if (isVisible) {
      collectMetrics();
      intervalRef.current = setInterval(collectMetrics, 5000); // 每5秒更新一次
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isVisible]);

  const getPerformanceStatus = (avgDuration: number) => {
    if (avgDuration > 100) return { status: 'error', color: '#ff4d4f', icon: <WarningOutlined /> };
    if (avgDuration > 50) return { status: 'warning', color: '#faad14', icon: <WarningOutlined /> };
    return { status: 'success', color: '#52c41a', icon: <CheckCircleOutlined /> };
  };

  const getTotalMetrics = () => {
    if (metrics.length === 0) return { totalCount: 0, avgDuration: 0, maxDuration: 0 };
    
    const totalCount = metrics.reduce((sum, m) => sum + m.count, 0);
    const totalDuration = metrics.reduce((sum, m) => sum + (m.avgDuration * m.count), 0);
    const avgDuration = totalCount > 0 ? totalDuration / totalCount : 0;
    const maxDuration = Math.max(...metrics.map(m => m.maxDuration));
    
    return { totalCount, avgDuration, maxDuration };
  };

  const totalMetrics = getTotalMetrics();

  if (!isVisible) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Button 
          type="primary" 
          icon={<DashboardOutlined />}
          onClick={() => setIsVisible(true)}
          size="small"
        >
          性能监控
        </Button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, width: 400 }}>
      <Card 
        title={
          <Space>
            <DashboardOutlined />
            实时性能监控
            <Button 
              type="text" 
              size="small" 
              onClick={() => setIsVisible(false)}
            >
              ×
            </Button>
          </Space>
        }
        size="small"
        style={{ maxHeight: 500, overflow: 'auto' }}
      >
        {/* 总体统计 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Statistic
              title="总事件数"
              value={totalMetrics.totalCount}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="平均耗时"
              value={totalMetrics.avgDuration.toFixed(1)}
              suffix="ms"
              valueStyle={{ 
                fontSize: 16,
                color: totalMetrics.avgDuration > 50 ? '#faad14' : '#52c41a'
              }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="最大耗时"
              value={totalMetrics.maxDuration.toFixed(1)}
              suffix="ms"
              valueStyle={{ 
                fontSize: 16,
                color: totalMetrics.maxDuration > 100 ? '#ff4d4f' : '#52c41a'
              }}
            />
          </Col>
        </Row>

        {/* 性能警告 */}
        {totalMetrics.avgDuration > 100 && (
          <Alert
            message="性能警告"
            description="实时事件处理器平均耗时超过100ms，可能影响用户体验"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 详细指标 */}
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {metrics.map((metric, index) => {
            const status = getPerformanceStatus(metric.avgDuration);
            return (
              <Card 
                key={index} 
                size="small" 
                style={{ marginBottom: 8 }}
                title={
                  <Space>
                    {status.icon}
                    <span style={{ color: status.color }}>{metric.handlerName}</span>
                  </Space>
                }
              >
                <Row gutter={8}>
                  <Col span={6}>
                    <Statistic
                      title="平均"
                      value={metric.avgDuration.toFixed(1)}
                      suffix="ms"
                      valueStyle={{ fontSize: 12 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="最大"
                      value={metric.maxDuration.toFixed(1)}
                      suffix="ms"
                      valueStyle={{ fontSize: 12 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="最小"
                      value={metric.minDuration.toFixed(1)}
                      suffix="ms"
                      valueStyle={{ fontSize: 12 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="次数"
                      value={metric.count}
                      valueStyle={{ fontSize: 12 }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  最近一次: {metric.lastDuration.toFixed(1)}ms
                </div>
              </Card>
            );
          })}
        </div>

        {/* 操作按钮 */}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Space>
            <Button size="small" onClick={collectMetrics}>
              刷新数据
            </Button>
            <Button 
              size="small" 
              type="link"
              onClick={() => {
                // 这里可以添加清除性能数据的逻辑
                console.log('清除性能数据');
              }}
            >
              清除数据
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default RealtimePerformanceMonitor;
