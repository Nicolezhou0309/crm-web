import { useEffect, useState } from 'react';
import { exchangePoints, filterExchangeRecords, getUserPointsInfo } from '../api/pointsApi';
import { useUser } from '../context/UserContext';
import { Card, Button, Typography, Space, Tag, message, Row, Col, Statistic, Alert, Spin, Table, Badge, Tabs, Divider } from 'antd';
import { GiftOutlined, WalletOutlined, LoadingOutlined, CrownOutlined, UserOutlined, TrophyOutlined, StarOutlined, FireOutlined, CheckCircleOutlined, TrophyFilled, GiftFilled, StarFilled } from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { AchievementSystem } from '../components/AchievementSystem';
import './PointsExchange.css';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

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
  const [activeTab, setActiveTab] = useState('achievements');
  const { profile } = useUser();

  useEffect(() => {
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
          <div style={{ fontWeight: 500, color: '#262626', fontSize: 13 }}>
            {new Date(text).toLocaleDateString()}
          </div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
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
        return <Tag color={color} style={{ fontWeight: 500, fontSize: 12 }}>{label}</Tag>;
      },
    },
    {
      title: '消耗积分',
      dataIndex: 'points_used',
      key: 'points_used',
      sorter: (a, b) => a.points_used - b.points_used,
      render: (text) => (
        <Text type="danger" strong style={{ fontSize: 13 }}>
          -{text}
        </Text>
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
        return <Tag color={color} style={{ fontWeight: 500, fontSize: 12 }}>{label}</Tag>;
      },
    },
  ];

  // 表格变化处理
  const handleTableChange: TableProps<ExchangeRecord>['onChange'] = (pagination, filters, sorter) => {
    console.log('表格变化:', { pagination, filters, sorter });
  };

  // 渲染积分兑换内容
  const renderPointsExchange = () => (
    <div style={{ padding: '0' }}>

      {/* 兑换选项 */}
      <Card>
        <Row gutter={[16, 16]}>
          {/* 线索兑换 */}
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              style={{ 
                borderRadius: 8, 
                border: '1px solid #e6f7ff',
                transition: 'all 0.3s ease',
                marginTop: 12,
                marginBottom: 12
              }}
              bodyStyle={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#e6f7ff',
                color: '#1890ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 18
              }}>
                <UserOutlined />
              </div>
              
              <Title level={5} style={{ margin: '8px 0 4px', color: '#1890ff', fontSize: 14 }}>
                兑换线索
              </Title>
              
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, lineHeight: 1.4, fontSize: 12 }}>
                使用积分兑换高质量线索
              </Text>
              
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 12,
                background: '#e6f7ff',
                color: '#1890ff',
                fontWeight: 600,
                fontSize: 12,
                marginBottom: 12
              }}>
                30 积分
              </div>
              
              <Button
                type="primary"
                size="small"
                block
                disabled={userPoints < 30}
                style={{ 
                  height: 32, 
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 12
                }}
                onClick={() => handleExchange('LEAD', 1, 30, '兑换线索')}
              >
                {userPoints >= 30 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
          
          {/* 礼品兑换 */}
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              style={{ 
                borderRadius: 8, 
                border: '1px solid #f9f0ff',
                transition: 'all 0.3s ease',
                marginTop: 12,
                marginBottom: 12
              }}
              bodyStyle={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#f9f0ff',
                color: '#722ed1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 18
              }}>
                <GiftOutlined />
              </div>
              
              <Title level={5} style={{ margin: '8px 0 4px', color: '#722ed1', fontSize: 14 }}>
                兑换礼品
              </Title>
              
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, lineHeight: 1.4, fontSize: 12 }}>
                兑换精美礼品，犒劳自己
              </Text>
              
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 12,
                background: '#f9f0ff',
                color: '#722ed1',
                fontWeight: 600,
                fontSize: 12,
                marginBottom: 12
              }}>
                50 积分
              </div>
              
              <Button
                type="primary"
                size="small"
                block
                disabled={userPoints < 50}
                style={{ 
                  height: 32, 
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 12,
                  background: '#722ed1',
                  borderColor: '#722ed1'
                }}
                onClick={() => handleExchange('GIFT', 1, 50, '兑换礼品')}
              >
                {userPoints >= 50 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
          
          {/* 特权兑换 */}
          <Col xs={24} sm={12} lg={8}>
            <Card 
              hoverable
              style={{ 
                borderRadius: 8, 
                border: '1px solid #f6ffed',
                transition: 'all 0.3s ease',
                marginTop: 12,
                marginBottom: 12
              }}
              bodyStyle={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: '#f6ffed',
                color: '#52c41a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: 18
              }}>
                <CrownOutlined />
              </div>
              
              <Title level={5} style={{ margin: '8px 0 4px', color: '#52c41a', fontSize: 14 }}>
                兑换特权
              </Title>
              
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, lineHeight: 1.4, fontSize: 12 }}>
                兑换特殊权限，享受便利
              </Text>
              
              <div style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: 12,
                background: '#f6ffed',
                color: '#52c41a',
                fontWeight: 600,
                fontSize: 12,
                marginBottom: 12
              }}>
                100 积分
              </div>
              
              <Button
                type="primary"
                size="small"
                block
                disabled={userPoints < 100}
                style={{ 
                  height: 32, 
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: 12,
                  background: '#52c41a',
                  borderColor: '#52c41a'
                }}
                onClick={() => handleExchange('PRIVILEGE', 1, 100, '兑换特权')}
              >
                {userPoints >= 100 ? '立即兑换' : '积分不足'}
              </Button>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );

  // 渲染兑换记录内容
  const renderExchangeRecords = () => (
    <Card 
      title={
        <Space>
          <StarFilled style={{ color: '#fa8c16', fontSize: 14 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>兑换记录</span>
          <Badge count={exchangeRecords.length} style={{ backgroundColor: '#1890ff', fontSize: 10 }} />
        </Space>
      }
      style={{ borderRadius: 8 }}
      headStyle={{ borderBottom: '1px solid #f0f0f0', padding: '0 16px', minHeight: 40 }}
      bodyStyle={{ padding: '16px' }}
    >
      {exchangeRecords.length > 0 ? (
        <Table
          dataSource={exchangeRecords}
          columns={columns}
          onChange={handleTableChange}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            style: { marginTop: 12 },
            size: 'small'
          }}
          size="small"
          rowKey="id"
          style={{ borderRadius: 6 }}
        />
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 0',
          color: '#8c8c8c'
        }}>
          <GiftOutlined style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }} />
          <Text type="secondary" style={{ fontSize: 14 }}>暂无兑换记录</Text>
        </div>
      )}
    </Card>
  );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: 300 
      }}>
        <Spin size="default" indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
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
        style={{ margin: 16 }}
      />
    );
  }

  return (
    <div style={{ padding: '16px', maxWidth: 1000, margin: '0 auto' }}>
      {/* 顶部积分统计 */}
      <Card 
        style={{ 
          marginBottom: 16,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: 8
        }}
        bodyStyle={{ padding: '16px 20px', textAlign: 'center' }}
      >
        <Row justify="center" align="middle">
          <Col>
            <WalletOutlined style={{ fontSize: 20, color: '#fff', marginBottom: 4 }} />
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>当前积分</span>}
              value={userPoints}
              valueStyle={{ color: '#fff', fontSize: 20, fontWeight: 'bold' }}
              prefix={<span style={{ color: '#fff' }}>💰</span>}
            />
          </Col>
        </Row>
      </Card>

      {/* 标签页内容 */}
      <Card 
        style={{ 
          borderRadius: 8,
          border: '1px solid #f0f0f0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          size="small"
          tabBarStyle={{ 
            marginBottom: 16,
            borderBottom: '1px solid #f0f0f0'
          }}
          tabBarGutter={4}
        >
          <TabPane 
            tab={
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                <TrophyFilled style={{ marginRight: 6, color: '#fa8c16', fontSize: 12 }} />
                成就系统
              </span>
            } 
            key="achievements"
          >
            <AchievementSystem showHeader={false} compact={true} />
          </TabPane>
          
          <TabPane 
            tab={
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                <GiftFilled style={{ marginRight: 6, color: '#722ed1', fontSize: 12 }} />
                积分兑换
              </span>
            } 
            key="exchange"
          >
            {renderPointsExchange()}
          </TabPane>
          
          <TabPane 
            tab={
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                <StarFilled style={{ marginRight: 6, color: '#fa8c16', fontSize: 12 }} />
                兑换记录
              </span>
            } 
            key="records"
          >
            {renderExchangeRecords()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
} 