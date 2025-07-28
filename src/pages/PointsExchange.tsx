import { useEffect, useState } from 'react';
import { exchangePoints, filterExchangeRecords, getUserPointsInfo, getCurrentProfileId } from '../api/pointsApi';
import { useUser } from '../context/UserContext';
import { Card, Button, Typography, Space, Tag, message, Row, Col, Statistic, Alert, Spin, Table } from 'antd';
import { GiftOutlined, WalletOutlined, LoadingOutlined, CrownOutlined, UserOutlined } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';

interface ExchangeRecord {
  id: number;
  exchange_type: string;
  target_id: number;
  points_used: number;
  exchange_time: string;
  status: string;
}

export default function PointsExchange() {
  const [exchangeRecords, setExchangeRecords] = useState<ExchangeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [profileId, setProfileId] = useState<number | null>(null);
  const { user, profile } = useUser();

  useEffect(() => {
    // 直接使用profile中的id，避免重复查询
    if (profile?.id) {
      setProfileId(profile.id);
    }
  }, [profile]);

  useEffect(() => {
    if (profileId) {
      loadUserPoints(profileId);
      loadExchangeRecords(profileId);
    }
  }, [profileId]);

  const loadUserPoints = async (id: number) => {
    try {
      const data = await getUserPointsInfo(id);
      setUserPoints(data.wallet.total_points);
    } catch (err) {
      console.error('获取用户积分失败:', err);
    }
  };

  const loadExchangeRecords = async (id: number) => {
    try {
      setLoading(true);
      const data = await filterExchangeRecords(id, {
        orderBy: 'exchange_time',
        ascending: false,
        limit: 50
      });
      setExchangeRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载兑换记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleExchange = async (exchangeType: string, targetId: number, pointsRequired: number, description: string) => {
    try {
      if (!profileId) return;
      const result = await exchangePoints(profileId, exchangeType, targetId, pointsRequired, description);
      if (result.success) {
        message.success(`兑换成功！消耗 ${result.points_used} 积分`);
        loadUserPoints(profileId);
        loadExchangeRecords(profileId);
      } else {
        message.error(`兑换失败：${result.error}`);
      }
    } catch (err) {
      message.error('兑换失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  // 表格列定义
  const columns: ColumnsType<ExchangeRecord> = [
    {
      title: '兑换时间',
      dataIndex: 'exchange_time',
      key: 'exchange_time',
      sorter: (a, b) => new Date(a.exchange_time).getTime() - new Date(b.exchange_time).getTime(),
      defaultSortOrder: 'descend',
      render: (text) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {new Date(text).toLocaleDateString()}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {new Date(text).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      title: '兑换类型',
      dataIndex: 'exchange_type',
      key: 'exchange_type',
      filters: [
        { text: '线索', value: 'LEAD' },
        { text: '礼品', value: 'GIFT' },
        { text: '特权', value: 'PRIVILEGE' },
      ],
      onFilter: (value, record) => record.exchange_type === value,
      render: (text) => {
        const color = text === 'LEAD' ? 'blue' : text === 'GIFT' ? 'purple' : 'green';
        const label = text === 'LEAD' ? '线索' :
                     text === 'GIFT' ? '礼品' :
                     text === 'PRIVILEGE' ? '特权' : text;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '消耗积分',
      dataIndex: 'points_used',
      key: 'points_used',
      sorter: (a, b) => a.points_used - b.points_used,
      render: (text) => (
        <Typography.Text type="danger" strong>
          -{text}
        </Typography.Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: '成功', value: 'SUCCESS' },
        { text: '处理中', value: 'PENDING' },
        { text: '失败', value: 'FAILED' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (text) => {
        const color = text === 'SUCCESS' ? 'success' : text === 'PENDING' ? 'warning' : 'error';
        const label = text === 'SUCCESS' ? '成功' :
                     text === 'PENDING' ? '处理中' :
                     text === 'FAILED' ? '失败' : text;
        return <Tag color={color}>{label}</Tag>;
      },
    },
  ];

  // 表格变化处理
  const handleTableChange: TableProps<ExchangeRecord>['onChange'] = (pagination, filters, sorter) => {
    console.log('表格变化:', { pagination, filters, sorter });
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
          <Button size="small" danger onClick={() => profileId && loadExchangeRecords(profileId)}>
            重试
          </Button>
        }
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>

      {/* 用户积分信息 */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="当前可用积分"
              value={userPoints}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={16}>
            <Typography.Text type="secondary">
              积分可用于兑换高质量线索、精美礼品和特殊权限，提升您的销售业绩
            </Typography.Text>
          </Col>
        </Row>
      </Card>

      {/* 兑换选项 */}
      <Card title="兑换选项" style={{ marginBottom: '24px' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <UserOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                <Typography.Title level={4} style={{ margin: '8px 0' }}>
                  兑换线索
                </Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  使用积分兑换高质量线索，提升销售业绩
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '24px', color: '#1890ff' }}>
                  30 积分
                </Typography.Text>
              </div>
              <Button
                type="primary"
                size="large"
                block
                disabled={userPoints < 30}
                onClick={() => handleExchange('LEAD', 1, 30, '兑换线索')}
              >
                {userPoints >= 30 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
          
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <GiftOutlined style={{ fontSize: 48, color: '#722ed1', marginBottom: 16 }} />
                <Typography.Title level={4} style={{ margin: '8px 0' }}>
                  兑换礼品
                </Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  兑换精美礼品，犒劳自己的努力
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '24px', color: '#722ed1' }}>
                  50 积分
                </Typography.Text>
              </div>
              <Button
                type="primary"
                size="large"
                block
                disabled={userPoints < 50}
                onClick={() => handleExchange('GIFT', 1, 50, '兑换礼品')}
                style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
              >
                {userPoints >= 50 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
          
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: 'center', height: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div>
                <CrownOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
                <Typography.Title level={4} style={{ margin: '8px 0' }}>
                  兑换特权
                </Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  兑换特殊权限，享受更多便利
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '24px', color: '#52c41a' }}>
                  100 积分
                </Typography.Text>
              </div>
              <Button
                type="primary"
                size="large"
                block
                disabled={userPoints < 100}
                onClick={() => handleExchange('PRIVILEGE', 1, 100, '兑换特权')}
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                {userPoints >= 100 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 兑换记录表格 */}
      <Card 
        title={
          <Space>
            <span>兑换记录</span>
            <Typography.Text type="secondary">共 {exchangeRecords.length} 条记录</Typography.Text>
          </Space>
        }
      >
        {exchangeRecords.length > 0 ? (
          <Table
            dataSource={exchangeRecords}
            columns={columns}
            onChange={handleTableChange}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            size="small"
            rowKey="id"
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <GiftOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Typography.Text type="secondary">暂无兑换记录</Typography.Text>
          </div>
        )}
      </Card>
    </div>
  );
} 