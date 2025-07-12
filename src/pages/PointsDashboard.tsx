import React, { useEffect, useState } from 'react';
import { getUserPointsInfo, awardPoints, getCurrentProfileId, filterPointsTransactions } from '../api/pointsApi';
import { getUserPointsAllocationStats, getUserPointsAllocationHistory } from '../api/pointsAllocationApi';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Button, Table, Tag, Space, Statistic, Typography, Spin, Alert } from 'antd';
import { 
  TrophyOutlined, PlusOutlined, MinusOutlined, WalletOutlined, LoadingOutlined,
  BranchesOutlined, BarChartOutlined, CheckCircleOutlined, ExclamationCircleOutlined, DollarOutlined
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';

interface PointsInfo {
  wallet: {
    total_points: number;
    total_earned_points: number;
    total_consumed_points: number;
    updated_at: string;
  };
  recent_transactions: Array<{
    id: number;
    points_change: number;
    balance_after: number;
    transaction_type: string;
    source_type: string;
    description: string;
    created_at: string;
  }>;
}

interface AllocationStats {
  total_allocations: number;
  successful_allocations: number;
  insufficient_points_allocations: number;
  total_points_cost: number;
  successful_points_cost: number;
  avg_points_cost: number;
}

interface Transaction {
  id: number;
  points_change: number;
  balance_after: number;
  transaction_type: string;
  source_type: string;
  description: string;
  created_at: string;
}

export default function PointsDashboard() {
  const [pointsInfo, setPointsInfo] = useState<PointsInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allocationStats, setAllocationStats] = useState<AllocationStats | null>(null);
  const [allocationHistory, setAllocationHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentProfileId().then(setProfileId);
  }, [user]);

  useEffect(() => {
    if (profileId) {
      loadPointsInfo(profileId);
      loadTransactions(profileId);
      loadAllocationData(profileId);
    }
  }, [profileId]);

  const loadPointsInfo = async (id: number) => {
    try {
      setLoading(true);
      const data = await getUserPointsInfo(id);
      setPointsInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载积分信息失败');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (id: number) => {
    try {
      const data = await filterPointsTransactions(id, {
        orderBy: 'created_at',
        ascending: false,
        limit: 50
      });
      setTransactions(data);
    } catch (err) {
      console.error('加载积分明细失败:', err);
    }
  };

  const loadAllocationData = async (id: number) => {
    try {
      const [statsData, historyData] = await Promise.all([
        getUserPointsAllocationStats(id),
        getUserPointsAllocationHistory(id, { limit: 10 })
      ]);
      setAllocationStats(statsData);
      setAllocationHistory(historyData);
    } catch (err) {
      console.error('加载分配数据失败:', err);
    }
  };

  const handleSignIn = async () => {
    try {
      if (!profileId) return;
      setSigningIn(true);
      const result = await awardPoints(profileId, 'SIGNIN', undefined, '每日签到');
      if (result.success) {
        // 使用现代化的通知方式
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse';
        notification.textContent = `🎉 签到成功！获得 ${result.points_awarded} 积分`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        loadPointsInfo(profileId);
        loadTransactions(profileId);
      } else {
        alert(`签到失败：${result.error}`);
      }
    } catch (err) {
      alert('签到失败：' + (err instanceof Error ? err.message : '未知错误'));
    } finally {
      setSigningIn(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<Transaction> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
      title: '交易类型',
      dataIndex: 'transaction_type',
      key: 'transaction_type',
      filters: [
        { text: '获得积分', value: 'EARN' },
        { text: '积分兑换', value: 'EXCHANGE' },
        { text: '积分扣除', value: 'DEDUCT' },
      ],
      onFilter: (value, record) => record.transaction_type === value,
      render: (text) => {
        const color = text === 'EARN' ? 'green' : text === 'EXCHANGE' ? 'blue' : 'red';
        const label = text === 'EARN' ? '获得' : text === 'EXCHANGE' ? '兑换' : '扣分';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '来源类型',
      dataIndex: 'source_type',
      key: 'source_type',
      filters: [
        { text: '跟进任务', value: 'FOLLOWUP' },
        { text: '成交订单', value: 'DEAL' },
        { text: '每日签到', value: 'SIGNIN' },
        { text: '兑换线索', value: 'EXCHANGE_LEAD' },
      ],
      onFilter: (value, record) => record.source_type === value,
      render: (text) => {
        const label = text === 'FOLLOWUP' ? '跟进' :
                     text === 'DEAL' ? '成交' :
                     text === 'SIGNIN' ? '签到' :
                     text === 'EXCHANGE_LEAD' ? '兑换线索' : text;
        return <Tag color="default">{label}</Tag>;
      },
    },
    {
      title: '积分变动',
      dataIndex: 'points_change',
      key: 'points_change',
      sorter: (a, b) => a.points_change - b.points_change,
      render: (text) => (
        <Typography.Text type={text > 0 ? 'success' : 'danger'}>
          {text > 0 ? '+' : ''}{text}
        </Typography.Text>
      ),
    },
    {
      title: '余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      sorter: (a, b) => a.balance_after - b.balance_after,
      render: (text) => <Typography.Text strong>{text}</Typography.Text>,
    },
    {
      title: '说明',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  // 表格变化处理
  const handleTableChange: TableProps<Transaction>['onChange'] = (pagination, filters, sorter) => {
    console.log('表格变化:', { pagination, filters, sorter });
    // 这里可以添加额外的处理逻辑，比如重新请求数据
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
          <Button size="small" danger onClick={() => profileId && loadPointsInfo(profileId)}>
            重试
          </Button>
        }
      />
    );
  }

  if (!pointsInfo) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <TrophyOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <Typography.Text type="secondary">暂无积分信息</Typography.Text>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px' }}>

      {/* 快捷操作按钮 */}
      <Space style={{ marginBottom: '24px' }}>
        <Button
          type="primary"
          icon={<WalletOutlined />}
          loading={signingIn}
          onClick={handleSignIn}
        >
          每日签到
        </Button>
        <Button
          type="default"
          icon={<TrophyOutlined />}
          onClick={() => navigate('/points/exchange')}
        >
          积分兑换
        </Button>
      </Space>

      {/* 积分概览卡片 */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前积分"
              value={pointsInfo.wallet.total_points || 0}
              prefix={<WalletOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计获得"
              value={pointsInfo.wallet.total_earned_points || 0}
              prefix={<PlusOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计消耗"
              value={pointsInfo.wallet.total_consumed_points || 0}
              prefix={<MinusOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="线索分配消耗"
              value={allocationStats?.successful_points_cost || 0}
              prefix={<BranchesOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix="积分"
            />
          </Card>
        </Col>
      </Row>

      {/* 分配统计卡片 */}
      {allocationStats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="分配总数"
                value={allocationStats.total_allocations}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="成功分配"
                value={allocationStats.successful_allocations}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="积分不足"
                value={allocationStats.insufficient_points_allocations}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="平均成本"
                value={allocationStats.avg_points_cost}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#722ed1' }}
                suffix="积分"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 积分明细表格 */}
      <Card 
        title={
          <Space>
            <span>积分明细</span>
            <Typography.Text type="secondary">共 {transactions.length} 条记录</Typography.Text>
          </Space>
        }
      >
        {transactions.length > 0 ? (
          <Table
            dataSource={transactions}
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
            <TrophyOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Typography.Text type="secondary">暂无交易记录</Typography.Text>
          </div>
        )}
      </Card>
    </div>
  );
} 