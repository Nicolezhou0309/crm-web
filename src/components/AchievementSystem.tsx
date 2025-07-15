import React, { useState } from 'react';
import {
  Card, Row, Col, Progress, Tag, Space, Typography, Button, 
  Avatar, Modal, Tabs, Statistic, 
  Spin} from 'antd';
import {
  TrophyOutlined, StarOutlined, FireOutlined,
  CheckCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { useAchievements } from '../hooks/useAchievements';
import type { Achievement, AvatarFrame, Badge } from '../api/achievementApi';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface AchievementSystemProps {
  showHeader?: boolean;
  compact?: boolean;
}

export const AchievementSystem: React.FC<AchievementSystemProps> = ({
  showHeader = true,
  compact = false
}) => {
  const {
    achievements,
    avatarFrames,
    badges,
    stats,
    loading,
    equipAvatarFrame,
    equipBadge,
    getAchievementsByCategory,
    getRarityColor,
    getRarityText,
    getCategoryText,
    getCategoryColor
  } = useAchievements();

  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [achievementModalVisible, setAchievementModalVisible] = useState(false);
  const [avatarFrameModalVisible, setAvatarFrameModalVisible] = useState(false);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);

  // 渲染成就卡片
  const renderAchievementCard = (achievement: Achievement) => {
    const isCompleted = achievement.is_completed;
    const progressPercentage = achievement.progress_percentage;
    
    return (
      <Card
        key={achievement.achievement_id}
        hoverable
        style={{
          marginBottom: 16,
          border: isCompleted ? '2px solid #52c41a' : '1px solid #f0f0f0',
          borderRadius: 12,
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => {
          setSelectedAchievement(achievement);
          setAchievementModalVisible(true);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div
            style={{
              fontSize: 32,
              marginRight: 12,
              opacity: isCompleted ? 1 : 0.6
            }}
          >
            {achievement.icon}
          </div>
          <div style={{ flex: 1 }}>
            <Title level={5} style={{ margin: 0, color: achievement.color }}>
              {achievement.name}
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {achievement.description}
            </Text>
          </div>
          {isCompleted && (
            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <Space wrap>
            <Tag color={getCategoryColor(achievement.category)}>
              {getCategoryText(achievement.category)}
            </Tag>
            {achievement.points_reward > 0 && (
              <Tag color="gold">
                +{achievement.points_reward} 积分
              </Tag>
            )}
            {achievement.avatar_frame_id && (
              <Tag color="blue">头像框</Tag>
            )}
            {achievement.badge_id && (
              <Tag color="purple">勋章</Tag>
            )}
          </Space>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              进度: {achievement.progress} / {achievement.target}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {progressPercentage}%
            </Text>
          </div>
          <Progress
            percent={progressPercentage}
            size="small"
            strokeColor={isCompleted ? '#52c41a' : achievement.color}
            showInfo={false}
          />
        </div>
      </Card>
    );
  };

  // 渲染头像框卡片
  const renderAvatarFrameCard = (frame: AvatarFrame) => {
    return (
      <Card
        key={frame.frame_id}
        hoverable
        style={{
          marginBottom: 16,
          border: frame.is_equipped ? '2px solid #1890ff' : '1px solid #f0f0f0',
          borderRadius: 12
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <Avatar
              size={64}
              icon={<UserOutlined />}
              style={{
                ...frame.frame_data,
                border: frame.is_equipped ? '3px solid #1890ff' : undefined
              }}
            />
          </div>
          <Title level={5} style={{ margin: '8px 0' }}>
            {frame.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {frame.description}
          </Text>
          <Tag color={getRarityColor(frame.rarity)} style={{ marginBottom: 8 }}>
            {getRarityText(frame.rarity)}
          </Tag>
          <div>
            {frame.is_equipped ? (
              <Button type="primary" size="small" disabled>
                已装备
              </Button>
            ) : (
              <Button
                type="default"
                size="small"
                onClick={() => equipAvatarFrame(frame.frame_id)}
              >
                装备
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 渲染勋章卡片
  const renderBadgeCard = (badge: Badge) => {
    return (
      <Card
        key={badge.badge_id}
        hoverable
        style={{
          marginBottom: 16,
          border: badge.is_equipped ? '2px solid #1890ff' : '1px solid #f0f0f0',
          borderRadius: 12
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 48,
                color: badge.color,
                opacity: badge.is_equipped ? 1 : 0.6
              }}
            >
              {badge.icon}
            </div>
          </div>
          <Title level={5} style={{ margin: '8px 0' }}>
            {badge.name}
          </Title>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            {badge.description}
          </Text>
          <Tag color={getRarityColor(badge.rarity)} style={{ marginBottom: 8 }}>
            {getRarityText(badge.rarity)}
          </Tag>
          <div>
            {badge.is_equipped ? (
              <Button type="primary" size="small" disabled>
                已佩戴
              </Button>
            ) : (
              <Button
                type="default"
                size="small"
                onClick={() => equipBadge(badge.badge_id)}
              >
                佩戴
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>加载成就数据中...</div>
      </div>
    );
  }

  return (
    <div className="achievement-system">
      {showHeader && (
        <div style={{ marginBottom: 24 }}>
          <Title level={3}>
            <TrophyOutlined style={{ marginRight: 8 }} />
            成就系统
          </Title>
          {stats && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={6}>
                <Statistic
                  title="总成就"
                  value={stats.total}
                  prefix={<TrophyOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="已完成"
                  value={stats.completed}
                  valueStyle={{ color: '#52c41a' }}
                  prefix={<CheckCircleOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="完成率"
                  value={stats.completion_rate}
                  suffix="%"
                  valueStyle={{ color: '#1890ff' }}
                  prefix={<StarOutlined />}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="获得积分"
                  value={stats.total_points_earned}
                  valueStyle={{ color: '#fa8c16' }}
                  prefix={<FireOutlined />}
                />
              </Col>
            </Row>
          )}
        </div>
      )}

      <Tabs defaultActiveKey="all" size={compact ? 'small' : 'middle'}>
        <TabPane tab="全部成就" key="all">
          <Row gutter={16}>
            {achievements.map(achievement => (
              <Col key={achievement.achievement_id} span={compact ? 12 : 8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="里程碑" key="milestone">
          <Row gutter={16}>
            {getAchievementsByCategory().milestone?.map(achievement => (
              <Col key={achievement.achievement_id} span={compact ? 12 : 8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="技能" key="skill">
          <Row gutter={16}>
            {getAchievementsByCategory().skill?.map(achievement => (
              <Col key={achievement.achievement_id} span={compact ? 12 : 8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="社交" key="social">
          <Row gutter={16}>
            {getAchievementsByCategory().social?.map(achievement => (
              <Col key={achievement.achievement_id} span={compact ? 12 : 8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="特殊" key="special">
          <Row gutter={16}>
            {getAchievementsByCategory().special?.map(achievement => (
              <Col key={achievement.achievement_id} span={compact ? 12 : 8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="头像框" key="avatar-frames">
          <Row gutter={16}>
            {avatarFrames.map(frame => (
              <Col key={frame.frame_id} span={compact ? 12 : 6}>
                {renderAvatarFrameCard(frame)}
              </Col>
            ))}
          </Row>
        </TabPane>

        <TabPane tab="勋章" key="badges">
          <Row gutter={16}>
            {badges.map(badge => (
              <Col key={badge.badge_id} span={compact ? 12 : 6}>
                {renderBadgeCard(badge)}
              </Col>
            ))}
          </Row>
        </TabPane>
      </Tabs>

      {/* 成就详情弹窗 */}
      <Modal
        title={
          <Space>
            <span style={{ fontSize: 24 }}>{selectedAchievement?.icon}</span>
            <span>{selectedAchievement?.name}</span>
          </Space>
        }
        open={achievementModalVisible}
        onCancel={() => setAchievementModalVisible(false)}
        footer={null}
        width={500}
      >
        {selectedAchievement && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>{selectedAchievement.description}</Text>
            </div>
            
            <div style={{ marginBottom: 16 }}>
              <Space wrap>
                <Tag color={getCategoryColor(selectedAchievement.category)}>
                  {getCategoryText(selectedAchievement.category)}
                </Tag>
                {selectedAchievement.points_reward > 0 && (
                  <Tag color="gold">
                    奖励: +{selectedAchievement.points_reward} 积分
                  </Tag>
                )}
                {selectedAchievement.avatar_frame_id && (
                  <Tag color="blue">解锁头像框</Tag>
                )}
                {selectedAchievement.badge_id && (
                  <Tag color="purple">解锁勋章</Tag>
                )}
              </Space>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text>进度</Text>
                <Text>{selectedAchievement.progress} / {selectedAchievement.target}</Text>
              </div>
              <Progress
                percent={selectedAchievement.progress_percentage}
                strokeColor={selectedAchievement.color}
                showInfo={false}
              />
            </div>

            {selectedAchievement.is_completed && selectedAchievement.completed_at && (
              <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
                <Text type="success">
                  <CheckCircleOutlined style={{ marginRight: 8 }} />
                  完成于: {new Date(selectedAchievement.completed_at).toLocaleString()}
                </Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}; 