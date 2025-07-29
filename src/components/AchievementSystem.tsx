import React, { useState } from 'react';
import {
  Card, Row, Col, Progress, Tag, Space, Typography, Button, 
  Avatar, Modal, Menu, Statistic
} from 'antd';
import LoadingScreen from './LoadingScreen';
import {
  TrophyOutlined, StarOutlined, FireOutlined,
  CheckCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { useAchievements } from '../hooks/useAchievements';
import type { Achievement, AvatarFrame, Badge } from '../api/achievementApi';

const { Title, Text } = Typography;

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
  const [selectedCategory, setSelectedCategory] = useState('all');

  // 获取当前分类的成就
  const getCurrentAchievements = () => {
    switch (selectedCategory) {
      case 'all':
        return achievements;
      case 'milestone':
        return getAchievementsByCategory().milestone || [];
      case 'skill':
        return getAchievementsByCategory().skill || [];
      case 'social':
        return getAchievementsByCategory().social || [];
      case 'special':
        return getAchievementsByCategory().special || [];
      default:
        return achievements;
    }
  };

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedCategory(key);
  };

  // 渲染成就卡片
  const renderAchievementCard = (achievement: Achievement) => {
    const isCompleted = achievement.is_completed;
    const progressPercentage = achievement.progress_percentage;
    
    return (
      <Card
        key={achievement.achievement_id}
        hoverable
        style={{
          marginBottom: 12,
          marginTop: 12,
          border: isCompleted ? '2px solid #52c41a' : '1px solid #f0f0f0',
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ 
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={() => {
          setSelectedAchievement(achievement);
          setAchievementModalVisible(true);
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8, flex: 1 }}>
          <div
            style={{
              fontSize: 24,
              marginRight: 8,
              opacity: isCompleted ? 1 : 0.6,
              flexShrink: 0
            }}
          >
            {achievement.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ 
              margin: 0, 
              color: achievement.color, 
              fontSize: 13, 
              lineHeight: 1.3,
              marginBottom: 6,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {achievement.name}
            </Title>
            <Text type="secondary" style={{ 
              fontSize: 11, 
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              marginBottom: 8
            }}>
              {achievement.description}
            </Text>
          </div>
          {isCompleted && (
            <CheckCircleOutlined style={{ 
              color: '#52c41a', 
              fontSize: 16,
              flexShrink: 0,
              marginLeft: 4
            }} />
          )}
        </div>

        {/* 积分奖励单独一行 */}
        {achievement.points_reward > 0 && (
          <div style={{ marginBottom: 8, flexShrink: 0 }}>
            <div style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: 4,
              background: '#fff7e6',
              color: '#d46b08',
              fontWeight: 600,
              fontSize: 10,
              border: '1px solid #ffd591'
            }}>
              +{achievement.points_reward} 积分
            </div>
          </div>
        )}

        {/* 标签区域 */}
        <div style={{ marginBottom: 8, flexShrink: 0 }}>
          <Space wrap size={4} style={{ width: '100%' }}>
            <Tag color={getCategoryColor(achievement.category)} style={{ 
              fontSize: 10, 
              padding: '0 6px',
              marginBottom: 4
            }}>
              {getCategoryText(achievement.category)}
            </Tag>
            {achievement.avatar_frame_id && (
              <Tag color="blue" style={{ 
                fontSize: 10, 
                padding: '0 6px',
                marginBottom: 4
              }}>头像框</Tag>
            )}
            {achievement.badge_id && (
              <Tag color="purple" style={{ 
                fontSize: 10, 
                padding: '0 6px',
                marginBottom: 4
              }}>勋章</Tag>
            )}
          </Space>
        </div>

        <div style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <Text type="secondary" style={{ fontSize: 10 }}>
              进度: {achievement.progress} / {achievement.target}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {progressPercentage}%
            </Text>
          </div>
          <Progress
            percent={progressPercentage}
            size="small"
            strokeColor={isCompleted ? '#52c41a' : achievement.color}
            showInfo={false}
            style={{ marginBottom: 0 }}
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
          marginBottom: 12,
          marginTop: 12,
          border: frame.is_equipped ? '2px solid #1890ff' : '1px solid #f0f0f0',
          borderRadius: 8,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ 
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center'
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <Avatar
              size={48}
              icon={<UserOutlined />}
              style={{
                ...frame.frame_data,
                border: frame.is_equipped ? '3px solid #1890ff' : undefined
              }}
            />
          </div>
          <Title level={5} style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.3 }}>
            {frame.name}
          </Title>
          <Text type="secondary" style={{ 
            fontSize: 11, 
            marginBottom: 6, 
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {frame.description}
          </Text>
          <Tag color={getRarityColor(frame.rarity)} style={{ 
            marginBottom: 6, 
            fontSize: 10, 
            padding: '0 6px' 
          }}>
            {getRarityText(frame.rarity)}
          </Tag>
        </div>
        <div style={{ flexShrink: 0 }}>
          {frame.is_equipped ? (
            <Button type="primary" size="small" disabled style={{ fontSize: 11, width: '100%' }}>
              已装备
            </Button>
          ) : (
            <Button
              type="default"
              size="small"
              style={{ fontSize: 11, width: '100%' }}
              onClick={() => equipAvatarFrame(frame.frame_id)}
            >
              装备
            </Button>
          )}
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
          marginBottom: 12,
          marginTop: 12,
          border: badge.is_equipped ? '2px solid #1890ff' : '1px solid #f0f0f0',
          borderRadius: 8,
          height: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}
        bodyStyle={{ 
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'center'
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                fontSize: 36,
                color: badge.color,
                opacity: badge.is_equipped ? 1 : 0.6
              }}
            >
              {badge.icon}
            </div>
          </div>
          <Title level={5} style={{ margin: '4px 0', fontSize: 13, lineHeight: 1.3 }}>
            {badge.name}
          </Title>
          <Text type="secondary" style={{ 
            fontSize: 11, 
            marginBottom: 6, 
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {badge.description}
          </Text>
          <Tag color={getRarityColor(badge.rarity)} style={{ 
            marginBottom: 6, 
            fontSize: 10, 
            padding: '0 6px' 
          }}>
            {getRarityText(badge.rarity)}
          </Tag>
        </div>
        <div style={{ flexShrink: 0 }}>
          {badge.is_equipped ? (
            <Button type="primary" size="small" disabled style={{ fontSize: 11, width: '100%' }}>
              已佩戴
            </Button>
          ) : (
            <Button
              type="default"
              size="small"
              style={{ fontSize: 11, width: '100%' }}
              onClick={() => equipBadge(badge.badge_id)}
            >
              佩戴
            </Button>
          )}
        </div>
      </Card>
    );
  };

  if (loading) {
    return <LoadingScreen type="data" />;
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

      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['all']}
            style={{ 
              height: '100%', 
              borderRight: '1px solid #f0f0f0',
            }}
            onClick={handleMenuClick}
          >
            <Menu.Item key="all" icon={<TrophyOutlined style={{ fontSize: 14 }} />} style={{ fontSize: 14, padding: '8px 12px' }}>
              全部成就
            </Menu.Item>
            <Menu.Item key="milestone" icon={<StarOutlined style={{ fontSize: 14 }} />} style={{ fontSize: 14, padding: '8px 12px' }}>
              里程碑
            </Menu.Item>
            <Menu.Item key="skill" icon={<FireOutlined style={{ fontSize: 14 }} />} style={{ fontSize: 14, padding: '8px 12px' }}>
              技能
            </Menu.Item>
            <Menu.Item key="social" icon={<UserOutlined style={{ fontSize: 14 }} />} style={{ fontSize: 14, padding: '8px 12px' }}>
              社交
            </Menu.Item>
            <Menu.Item key="special" icon={<CheckCircleOutlined style={{ fontSize: 14 }} />} style={{ fontSize: 14, padding: '8px 12px' }}>
              特殊
            </Menu.Item>
          </Menu>
        </Col>
        <Col span={20}>
          <Row gutter={[16, 16]}>
            {getCurrentAchievements().map(achievement => (
              <Col key={achievement.achievement_id} span={8}>
                {renderAchievementCard(achievement)}
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

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