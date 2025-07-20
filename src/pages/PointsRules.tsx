import { useEffect, useState } from 'react';
import { getPointsRules } from '../api/pointsApi';
import { Card, Row, Col, Statistic, Typography, Spin, Alert, Tag, Space, Divider } from 'antd';
import { 
  TrophyOutlined, 
  LoadingOutlined, 
  PlusOutlined, 
  MinusOutlined, 
  SwapOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';

interface PointsRule {
  id: number;
  rule_name: string;
  rule_type: string;
  source_type: string;
  points_value: number;
  description: string;
  is_active: boolean;
  max_times_per_day?: number;
  max_times_total?: number;
  created_at: string;
}

export default function PointsRules() {
  const [rules, setRules] = useState<PointsRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await getPointsRules();
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载积分规则失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="加载失败"
        description={error}
        type="error"
        showIcon
        action={
          <Typography.Link onClick={loadRules}>
            重试
          </Typography.Link>
        }
      />
    );
  }

  const earnRules = rules.filter(r => r.rule_type === 'EARN');
  const exchangeRules = rules.filter(r => r.rule_type === 'EXCHANGE');
  const deductRules = rules.filter(r => r.rule_type === 'DEDUCT');

  return (
    <div style={{ padding: '24px' }}>

      {/* 规则概览 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="获得积分规则"
              value={earnRules.length}
              prefix={<PlusOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="兑换规则"
              value={exchangeRules.length}
              prefix={<SwapOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="扣分规则"
              value={deductRules.length}
              prefix={<MinusOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 详细规则列表 */}
      <Card title="详细规则">
        {rules.length > 0 ? (
          <div>
            {rules.map((rule, index) => (
              <div key={rule.id}>
                <div style={{ padding: '16px 0' }}>
                  <Row gutter={16} align="middle">
                    <Col span={16}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                          <Space>
                            <Typography.Text strong style={{ fontSize: '16px' }}>
                              {rule.rule_name}
                            </Typography.Text>
                            <Tag color={
                              rule.rule_type === 'EARN' ? 'success' :
                              rule.rule_type === 'EXCHANGE' ? 'processing' : 'error'
                            }>
                              {rule.rule_type === 'EARN' ? '获得' : 
                               rule.rule_type === 'EXCHANGE' ? '兑换' : '扣分'}
                            </Tag>
                            {!rule.is_active && (
                              <Tag color="default">已停用</Tag>
                            )}
                          </Space>
                        </div>
                        <Typography.Text type="secondary">
                          {rule.description}
                        </Typography.Text>
                        <Space size="large">
                          <Typography.Text type="secondary">
                            积分值: {rule.points_value > 0 ? '+' : ''}{rule.points_value}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            来源: {rule.source_type}
                          </Typography.Text>
                          {rule.max_times_per_day && (
                            <Typography.Text type="secondary">
                              每日限制: {rule.max_times_per_day}次
                            </Typography.Text>
                          )}
                          {rule.max_times_total && (
                            <Typography.Text type="secondary">
                              总限制: {rule.max_times_total}次
                            </Typography.Text>
                          )}
                        </Space>
                      </Space>
                    </Col>
                    <Col span={8} style={{ textAlign: 'right' }}>
                      <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                        创建时间: {new Date(rule.created_at).toLocaleDateString()}
                      </Typography.Text>
                    </Col>
                  </Row>
                </div>
                {index < rules.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <TrophyOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Typography.Text type="secondary">暂无积分规则</Typography.Text>
          </div>
        )}
      </Card>

      {/* 规则说明 */}
      <Card 
        title={
          <Space>
            <InfoCircleOutlined />
            <span>积分规则说明</span>
          </Space>
        }
        style={{ marginTop: '24px' }}
        type="inner"
      >
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 8 }} />
              <Typography.Title level={5} style={{ margin: '8px 0' }}>
                获得积分
              </Typography.Title>
              <Typography.Text type="secondary">
                通过完成特定任务或行为获得积分奖励
              </Typography.Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <SwapOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 8 }} />
              <Typography.Title level={5} style={{ margin: '8px 0' }}>
                兑换积分
              </Typography.Title>
              <Typography.Text type="secondary">
                使用积分兑换线索、礼品或其他特权
              </Typography.Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <MinusOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 8 }} />
              <Typography.Title level={5} style={{ margin: '8px 0' }}>
                扣分规则
              </Typography.Title>
              <Typography.Text type="secondary">
                违规行为会导致积分扣除
              </Typography.Text>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center', padding: '16px' }}>
              <InfoCircleOutlined style={{ fontSize: 32, color: '#faad14', marginBottom: 8 }} />
              <Typography.Title level={5} style={{ margin: '8px 0' }}>
                限制说明
              </Typography.Title>
              <Typography.Text type="secondary">
                部分规则有每日或总次数限制，请注意查看
              </Typography.Text>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
} 