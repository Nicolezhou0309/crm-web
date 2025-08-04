import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, message } from 'antd';
import { getWeeklySchedule } from '../api/liveStreamApi';
import type { LiveStreamSchedule } from '../types/liveStream';

const DebugScoringData: React.FC = () => {
  const [data, setData] = useState<LiveStreamSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const schedules = await getWeeklySchedule();
      setData(schedules);
      console.log('调试数据:', schedules);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
    },
    {
      title: '评分状态',
      dataIndex: 'scoring_status',
      key: 'scoring_status',
      width: 100,
    },
    {
      title: '平均评分',
      dataIndex: 'average_score',
      key: 'average_score',
      width: 100,
      render: (value: any, record: LiveStreamSchedule) => {
        console.log('渲染评分:', { value, record });
        return (
          <div>
            <div>原始值: {JSON.stringify(value)}</div>
            <div>类型: {typeof value}</div>
            <div>布尔值: {!!value}</div>
            <div>渲染结果: {value ? `${value.toFixed(1)}分` : '-'}</div>
          </div>
        );
      },
    },
    {
      title: '评分人员',
      dataIndex: 'scored_by',
      key: 'scored_by',
      width: 100,
    },
    {
      title: '评分时间',
      dataIndex: 'scored_at',
      key: 'scored_at',
      width: 150,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Card title="评分数据调试" extra={
        <Space>
          <Button onClick={loadData} loading={loading}>
            刷新数据
          </Button>
        </Space>
      }>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
};

export default DebugScoringData; 