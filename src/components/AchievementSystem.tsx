import React, { useState } from 'react';
import { Spin } from 'antd';
import {
  TrophyOutlined, StarOutlined, FireOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { useAchievements } from '../hooks/useAchievements';
import { AchievementCard } from './AchievementCard';
import './AchievementSystem.css';

// 添加解锁动画样式
const unlockAnimationStyle = `
  @keyframes achievementLockOpen {
    0% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
    20% {
      transform: scale(1.3) rotate(-3deg);
      opacity: 1;
    }
    40% {
      transform: scale(1.4) rotate(2deg);
      opacity: 0.8;
    }
    60% {
      transform: scale(1.5) rotate(-1deg);
      opacity: 0.5;
    }
    80% {
      transform: scale(1.6) rotate(0deg);
      opacity: 0.2;
    }
    100% {
      transform: scale(1.7) rotate(0deg);
      opacity: 0;
    }
  }
  
  @keyframes achievementCheckAppear {
    0% {
      transform: scale(0) rotate(-90deg);
      opacity: 0;
    }
    20% {
      transform: scale(1.4) rotate(-45deg);
      opacity: 0.7;
    }
    40% {
      transform: scale(1.1) rotate(-15deg);
      opacity: 0.9;
    }
    60% {
      transform: scale(0.95) rotate(5deg);
      opacity: 1;
    }
    80% {
      transform: scale(1.05) rotate(-2deg);
      opacity: 1;
    }
    100% {
      transform: scale(1) rotate(0deg);
      opacity: 1;
    }
  }
`;

// 检查是否已经注入过动画样式，避免重复注入
let styleSheet: HTMLStyleElement | null = null;
if (!document.getElementById('achievement-animations')) {
  styleSheet = document.createElement('style');
  styleSheet.id = 'achievement-animations';
  styleSheet.textContent = unlockAnimationStyle;
  document.head.appendChild(styleSheet);
}

interface AchievementSystemProps {
  showHeader?: boolean;
}

export const AchievementSystem: React.FC<AchievementSystemProps> = ({
  showHeader = true
}) => {
  const {
    achievements,
    stats,
    loading,
    getAchievementsByCategory  } = useAchievements();

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

  // 如果正在加载，显示Ant Design的Spin组件
  if (loading) {
    return (
      <div className="achievement-system">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '400px',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <Spin size="large" />
          <div style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '14px' }}>
            加载成就数据中...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="achievement-system">
      {showHeader && (
        <div style={{ marginBottom: 24 }}>
          <div className="achievement-title">
            <TrophyOutlined className="achievement-title-icon" />
            成就系统
          </div>
          {stats && (
            <div className="achievement-stats">
              <div className="stat-card">
                <div className="stat-title">总成就</div>
                <div className="stat-value">
                  <TrophyOutlined />
                  {stats.total}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">已完成</div>
                <div className="stat-value completed">
                  <CheckCircleOutlined />
                  {stats.completed}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">完成率</div>
                <div className="stat-value rate">
                  <StarOutlined />
                  {stats.completion_rate}%
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-title">获得积分</div>
                <div className="stat-value points">
                  <FireOutlined />
                  {stats.total_points_earned}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="achievement-layout">
        <div className="achievement-menu">
          <div 
            className={`menu-item ${selectedCategory === 'all' ? 'selected' : ''}`}
            onClick={() => handleMenuClick({ key: 'all' })}
          >
            全部成就
          </div>
          <div 
            className={`menu-item ${selectedCategory === 'milestone' ? 'selected' : ''}`}
            onClick={() => handleMenuClick({ key: 'milestone' })}
          >
            里程碑
          </div>
          <div 
            className={`menu-item ${selectedCategory === 'skill' ? 'selected' : ''}`}
            onClick={() => handleMenuClick({ key: 'skill' })}
          >
            技能
          </div>
          <div 
            className={`menu-item ${selectedCategory === 'social' ? 'selected' : ''}`}
            onClick={() => handleMenuClick({ key: 'social' })}
          >
            社交
          </div>
          <div 
            className={`menu-item ${selectedCategory === 'special' ? 'selected' : ''}`}
            onClick={() => handleMenuClick({ key: 'special' })}
          >
            特殊
          </div>
        </div>
        <div className="achievement-cards">
          {getCurrentAchievements().map(achievement => (
            <AchievementCard
              key={achievement.achievement_id}
              achievement={achievement}
            />
          ))}
        </div>
      </div>
    </div>
  );
}; 