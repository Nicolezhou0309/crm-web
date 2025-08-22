import React, { useState } from 'react';
import type { Achievement } from '../api/achievementApi';

// SVG图标组件
const LockIcon: React.FC<{ color?: string; size?: number }> = ({ color = '#666', size = 16 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <circle cx="12" cy="16" r="1"></circle>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

const UnlockIcon: React.FC<{ color?: string; size?: number }> = ({ color = '#ff6b35', size = 16 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <circle cx="12" cy="16" r="1"></circle>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
  </svg>
);

const CheckIcon: React.FC<{ color?: string; size?: number; strokeWidth?: number }> = ({ color = '#52c41a', size = 16, strokeWidth = 2 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth={strokeWidth} 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <polyline points="20,6 9,17 4,12"></polyline>
  </svg>
);

interface AchievementCardProps {
  achievement: Achievement;
}

export const AchievementCard: React.FC<AchievementCardProps> = ({
  achievement
}) => {
  const [unlockingAchievement, setUnlockingAchievement] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(new Set());

  // 确定卡片状态
  const isCompleted = achievement.is_completed;
  let cardStatus: 'locked' | 'unlockable' | 'unlocked' = 'locked';
  
  if (isCompleted) {
    cardStatus = 'unlocked';
  } else if (achievement.progress > 0) {
    cardStatus = 'unlockable';
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'locked':
        return {
          iconColor: '#999',
          buttonBg: '#ccc',
          buttonColor: '#666',
          buttonDisabled: true
        };
      case 'unlockable':
        return {
          iconColor: '#ff6b35',
          buttonBg: '#ff6b35',
          buttonColor: 'white',
          buttonDisabled: false
        };
      case 'unlocked':
        return {
          iconColor: '#ff6b35',
          buttonBg: 'transparent',
          buttonColor: '#52c41a',
          buttonDisabled: false
        };
      default:
        return {
          iconColor: '#ff6b35',
          buttonBg: '#ff6b35',
          buttonColor: 'white',
          buttonDisabled: false
        };
    }
  };

  const handleButtonClick = (achievement: Achievement) => {
    if (cardStatus === 'locked') {
      // 未解锁状态
      return;
    } else if (cardStatus === 'unlockable') {
      // 开始解锁动画
      setUnlockingAchievement(achievement.achievement_id);
      
      // 模拟解锁过程
      setTimeout(() => {
        // 解锁完成，添加到已解锁列表
        setUnlockedAchievements(prev => new Set([...prev, achievement.achievement_id]));
        setUnlockingAchievement(null);
      }, 1000); // 1秒动画时间
    } else if (cardStatus === 'unlocked') {
      // 已解锁状态不响应点击
      return;
    }
  };

  const isUnlocking = unlockingAchievement === achievement.achievement_id;
  const isUnlocked = unlockedAchievements.has(achievement.achievement_id);
  const currentStatus = isUnlocked ? 'unlocked' : cardStatus;
  const currentStyles = getStatusStyles(currentStatus);



  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '200px',
        height: '180px',
        backgroundImage: 'url(/achievement_card.svg?v=' + Date.now() + ')',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        margin: '0 auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        color: '#333',
        padding: '16px 16px 20px 16px',
        boxSizing: 'border-box'
      }}>
        {/* 上半部分：图标和文字 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
          {/* 图标 */}
          <div style={{
            fontSize: '48px',
            marginBottom: '10px',
            lineHeight: '1',
            filter: currentStatus === 'locked' ? 'grayscale(100%)' : 'none',
            opacity: currentStatus === 'locked' ? 0.5 : 1
          }}>
            {achievement.icon}
          </div>
          
          {/* 成就名称 */}
          <div style={{
            fontSize: '14px',
            fontWeight: 'bold',
            marginBottom: '4px',
            lineHeight: '1.2',
            color: currentStatus === 'locked' ? '#999' : '#333'
          }}>
            {achievement.name}
          </div>
          
          {/* 成就描述 */}
          <div style={{
            fontSize: '11px',
            color: currentStatus === 'locked' ? '#ccc' : '#666',
            marginBottom: '3px',
            lineHeight: '1.2'
          }}>
            {achievement.description}
          </div>
          
          {/* 奖励积分 */}
          <div style={{
            fontSize: '12px',
            color: currentStatus === 'locked' ? '#ccc' : '#ff6b35',
            fontWeight: 'bold',
            lineHeight: '1.2',
            marginTop: '2px'
          }}>
            +{achievement.points_reward} 积分
          </div>
        </div>
        
        {/* 解锁按钮 */}
        <button 
          disabled={currentStyles.buttonDisabled}
          style={{
            backgroundColor: currentStyles.buttonBg,
            color: currentStyles.buttonColor,
            border: 'none',
            borderRadius: '12px',
            padding: '6px 14px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: currentStatus === 'unlocked' ? 'default' : (currentStyles.buttonDisabled ? 'not-allowed' : 'pointer'),
            boxShadow: currentStatus === 'unlocked' ? 'none' : (currentStyles.buttonDisabled ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'),
            transition: currentStatus === 'unlocked' ? 'none' : 'all 0.3s ease',
            minWidth: '80px',
            opacity: currentStyles.buttonDisabled ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            margin: 'auto',
            marginTop: '12px',
            outline: 'none'
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleButtonClick(achievement);
          }}>
          {/* 锁图标 - 解锁动画 */}
          {currentStatus === 'unlockable' && !isUnlocked && (
            <div style={{
              animation: isUnlocking ? 'achievementLockOpen 1s ease-in-out' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UnlockIcon color={currentStyles.buttonColor} size={12} />
            </div>
          )}
          
          {/* 对勾图标 - 解锁完成，只在解锁完成后显示 */}
          {(isUnlocked || currentStatus === 'unlocked') && !isUnlocking && (
            <div style={{
              animation: isUnlocked ? 'achievementCheckAppear 0.6s ease-out' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckIcon color={currentStyles.buttonColor} size={20} strokeWidth={3} />
            </div>
          )}
          
          {/* 锁定图标 */}
          {currentStatus === 'locked' && (
            <LockIcon color={currentStyles.buttonColor} size={12} />
          )}
        </button>
      </div>
      

    </div>
  );
}; 