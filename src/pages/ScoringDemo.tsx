import React, { useState } from 'react';
import { Card, Row, Col, Tag, Space, Typography } from 'antd';
import { StarOutlined, VideoCameraOutlined } from '@ant-design/icons';
import LiveStreamScoringDrawer from '../components/LiveStreamScoringDrawer';
import type { LiveStreamScheduleWithScoring } from '../types/scoring';

const { Title, Text } = Typography;

const ScoringDemo: React.FC = () => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<LiveStreamScheduleWithScoring | null>(null);

  // 模拟直播日程数据
  const mockSchedules: LiveStreamScheduleWithScoring[] = [
    {
      id: 1,
      date: '2024-01-15',
      timeSlotId: 'morning-10-12',
      participantIds: [123, 456],
      location: '钻石房',
      status: 'completed',
      createdBy: 123,
      createdAt: '2024-01-15T08:00:00Z',
      updatedAt: '2024-01-15T12:00:00Z',
      editingBy: null,
      editingAt: null,
      editingExpiresAt: null,
      lockType: 'none',
      lockReason: null,
      lockEndTime: null,
      scoring_status: 'scored',
      scored_by: 789,
      scored_at: '2024-01-15T12:30:00Z'
    },
    {
      id: 2,
      date: '2024-01-16',
      timeSlotId: 'afternoon-14-16',
      participantIds: [123],
      location: '平层',
      status: 'completed',
      createdBy: 123,
      createdAt: '2024-01-16T13:00:00Z',
      updatedAt: '2024-01-16T16:00:00Z',
      editingBy: null,
      editingAt: null,
      editingExpiresAt: null,
      lockType: 'none',
      lockReason: null,
      lockEndTime: null,
      scoring_status: 'not_scored',
      scored_by: null,
      scored_at: null
    },
    {
      id: 3,
      date: '2024-01-17',
      timeSlotId: 'evening-19-21',
      participantIds: [456, 789],
      location: 'LF两室',
      status: 'completed',
      createdBy: 456,
      createdAt: '2024-01-17T18:00:00Z',
      updatedAt: '2024-01-17T21:00:00Z',
      editingBy: null,
      editingAt: null,
      editingExpiresAt: null,
      lockType: 'none',
      lockReason: null,
      lockEndTime: null,
      scoring_status: 'approved',
      scored_by: 123,
      scored_at: '2024-01-17T21:30:00Z'
    }
  ];

  const handleOpenScoring = (schedule: LiveStreamScheduleWithScoring) => {
    setSelectedSchedule(schedule);
    setDrawerVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'scored':
        return 'blue';
      case 'not_scored':
        return 'default';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return '已审核';
      case 'scored':
        return '已评分';
      case 'not_scored':
        return '未评分';
      default:
        return '未知';
    }
  };

  const getScoreDisplay = (schedule: LiveStreamScheduleWithScoring) => {
    if (schedule.scoring_status === 'scored' || schedule.scoring_status === 'approved') {
      return (
        <Space>
          <StarOutlined style={{ color: '#faad14' }} />
          <Text strong>9.8分</Text>
        </Space>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <VideoCameraOutlined style={{ marginRight: 8 }} />
        直播评分演示
      </Title>
      
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        点击任意直播场次卡片可以打开评分抽屉进行评分操作
      </Text>

      <Row gutter={[16, 16]}>
        {mockSchedules.map(schedule => (
          <Col xs={24} sm={12} md={8} key={schedule.id}>
            <Card
              hoverable
              onClick={() => handleOpenScoring(schedule)}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>{schedule.date}</Text>
                    <Text type="secondary" style={{ marginLeft: 8 }}>
                      {schedule.timeSlotId}
                    </Text>
                  </div>
                  <div>
                    <Text>地点：{schedule.location}</Text>
                  </div>
                  <div>
                    <Text>参与者：{schedule.participantIds.length}人</Text>
                  </div>
                </Space>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Tag color={getStatusColor(schedule.scoring_status || 'not_scored')}>
                  {getStatusText(schedule.scoring_status || 'not_scored')}
                </Tag>
                {getScoreDisplay(schedule)}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <LiveStreamScoringDrawer
        visible={drawerVisible}
        schedule={selectedSchedule}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedSchedule(null);
        }}
      />
    </div>
  );
};

export default ScoringDemo; 