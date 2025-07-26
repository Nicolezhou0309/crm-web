import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Typography, Spin, Alert } from 'antd';
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  FileTextOutlined,
  DashboardOutlined,
  UserOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { getApprovalStatistics, getApprovalPerformanceMetrics, getUserApprovalStatistics } from '../api/approvalApi';
import { useUser } from '../context/UserContext';

const { Title, Text } = Typography;

interface PerformanceMetric {
  metric_name: string;
  metric_value: number | null;
  description: string;
}

interface UserStatistics {
  total_pending: number;
  total_approved: number;
  total_rejected: number;
  avg_response_time_minutes: number | null;
}

const ApprovalPerformance: React.FC = () => {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [userStatistics, setUserStatistics] = useState<UserStatistics | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 并行获取所有数据
      const [statsResult, metricsResult, userStatsResult] = await Promise.all([
        getApprovalStatistics(),
        getApprovalPerformanceMetrics(),
        user?.id ? getUserApprovalStatistics(Number(user.id)) : Promise.resolve({ data: null, error: null })
      ]);

      if (statsResult.data) {
        setStatistics(statsResult.data);
      }

      if (metricsResult.data) {
        setPerformanceMetrics(metricsResult.data);
      }

      if (userStatsResult.data) {
        setUserStatistics(userStatsResult.data);
      }
    } catch (error) {
      console.error('获取性能数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const performanceColumns = [
    {
      title: '指标名称',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '数值',
      dataIndex: 'metric_value',
      key: 'metric_value',
      render: (value: number | null, record: PerformanceMetric) => {
        if (value === null) return '-';
        
        switch (record.metric_name) {
          case 'avg_approval_duration_hours':
            return `${value.toFixed(2)} 小时`;
          case 'pending_instances_ratio':
            return `${value.toFixed(1)}%`;
          case 'avg_steps_per_instance':
            return value.toFixed(1);
          default:
            return value.toFixed(2);
        }
      },
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: PerformanceMetric) => {
        const value = record.metric_value;
        if (value === null) return '-';
        
        let color = 'green';
        let text = '正常';
        
        switch (record.metric_name) {
          case 'avg_approval_duration_hours':
            if (value > 24) {
              color = 'red';
              text = '需要优化';
            } else if (value > 8) {
              color = 'orange';
              text = '注意';
            }
            break;
          case 'pending_instances_ratio':
            if (value > 50) {
              color = 'red';
              text = '积压严重';
            } else if (value > 30) {
              color = 'orange';
              text = '需要关注';
            }
            break;
          case 'avg_steps_per_instance':
            if (value > 5) {
              color = 'orange';
              text = '流程复杂';
            }
            break;
        }
        
        return <Text style={{ color }}>{text}</Text>;
      },
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载性能数据中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <DashboardOutlined /> 审批性能监控
      </Title>

      {/* 总体统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="总审批实例"
              value={statistics?.total_instances || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="待审批实例"
              value={statistics?.pending_instances || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已同意"
              value={statistics?.approved_instances || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="已拒绝"
              value={statistics?.rejected_instances || 0}
              prefix={<CloseCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 性能指标表格 */}
      <Card title="性能指标" style={{ marginBottom: 24 }}>
        <Table
          dataSource={performanceMetrics}
          columns={performanceColumns}
          rowKey="metric_name"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 审批效率分析 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title="审批效率分析">
            <div style={{ marginBottom: 16 }}>
              <Text>平均审批时长</Text>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={statistics?.avg_approval_duration_minutes ? 
                    Math.min((statistics.avg_approval_duration_minutes / 60 / 24) * 100, 100) : 0}
                  status={statistics?.avg_approval_duration_minutes && statistics.avg_approval_duration_minutes > 1440 ? 'exception' : 'active'}
                  format={() => `${(statistics?.avg_approval_duration_minutes || 0) / 60} 小时`}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Text>待审批占比</Text>
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={statistics?.total_instances ? 
                    (statistics.pending_instances / statistics.total_instances) * 100 : 0}
                  status={statistics?.pending_instances && statistics.pending_instances > statistics.total_instances * 0.5 ? 'exception' : 'active'}
                />
              </div>
            </div>
          </Card>
        </Col>
        
        <Col span={12}>
          <Card title="个人统计" extra={<UserOutlined />}>
            {userStatistics ? (
              <div>
                <Row gutter={16}>
                  <Col span={8}>
                    <Statistic
                      title="待处理"
                      value={userStatistics.total_pending}
                      valueStyle={{ color: '#faad14' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="已处理"
                      value={userStatistics.total_approved + userStatistics.total_rejected}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="平均响应时间"
                      value={userStatistics.avg_response_time_minutes ? 
                        (userStatistics.avg_response_time_minutes / 60).toFixed(1) : 0}
                      suffix="小时"
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                </Row>
                
                <div style={{ marginTop: 16 }}>
                  <Text>处理效率</Text>
                  <div style={{ marginTop: 8 }}>
                    <Progress
                      percent={userStatistics.total_pending + userStatistics.total_approved + userStatistics.total_rejected > 0 ?
                        ((userStatistics.total_approved + userStatistics.total_rejected) / 
                         (userStatistics.total_pending + userStatistics.total_approved + userStatistics.total_rejected)) * 100 : 0}
                      status="active"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Alert
                message="未获取到个人统计数据"
                description="请确保已登录并具有相应权限"
                type="info"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 优化建议 */}
      <Card title="优化建议" style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col span={24}>
            {performanceMetrics.map(metric => {
              let suggestion = '';
              let type: 'success' | 'warning' | 'error' | 'info' = 'info';
              
              switch (metric.metric_name) {
                case 'avg_approval_duration_hours':
                  if (metric.metric_value && metric.metric_value > 24) {
                    suggestion = '建议优化审批流程，减少审批环节，提高审批效率';
                    type = 'error';
                  } else if (metric.metric_value && metric.metric_value > 8) {
                    suggestion = '审批时长较长，建议检查审批流程是否合理';
                    type = 'warning';
                  } else {
                    suggestion = '审批效率良好，继续保持';
                    type = 'success';
                  }
                  break;
                case 'pending_instances_ratio':
                  if (metric.metric_value && metric.metric_value > 50) {
                    suggestion = '待审批积压严重，建议增加审批人员或优化流程';
                    type = 'error';
                  } else if (metric.metric_value && metric.metric_value > 30) {
                    suggestion = '待审批比例较高，建议及时处理';
                    type = 'warning';
                  } else {
                    suggestion = '待审批比例合理';
                    type = 'success';
                  }
                  break;
                case 'avg_steps_per_instance':
                  if (metric.metric_value && metric.metric_value > 5) {
                    suggestion = '审批步骤较多，建议简化流程';
                    type = 'warning';
                  } else {
                    suggestion = '审批步骤合理';
                    type = 'success';
                  }
                  break;
              }
              
              return suggestion ? (
                <Alert
                  key={metric.metric_name}
                  message={metric.description}
                  description={suggestion}
                  type={type}
                  showIcon
                  style={{ marginBottom: 8 }}
                />
              ) : null;
            })}
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ApprovalPerformance; 