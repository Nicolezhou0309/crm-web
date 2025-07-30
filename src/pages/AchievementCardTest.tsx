import React from 'react';

// 添加扫光动画样式
const sweepAnimationStyle = `
  @keyframes sweep {
    0% {
      left: -100%;
    }
    100% {
      left: 100%;
    }
  }
  
  @keyframes lockOpen {
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
  
  @keyframes checkAppear {
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

// 注入CSS动画
const styleSheet = document.createElement('style');
styleSheet.textContent = sweepAnimationStyle;
document.head.appendChild(styleSheet);

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

// 模拟成就数据
const mockAchievements = [
  {
    id: '1',
    name: '新手成就',
    description: '完成第一个任务',
    icon: '🏆',
    points: 10,
    status: 'locked' // 未解锁
  },
  {
    id: '2', 
    name: '活跃用户',
    description: '连续登录7天',
    icon: '⭐',
    points: 20,
    status: 'unlockable' // 待解锁
  },
  {
    id: '3',
    name: '任务达人',
    description: '完成10个任务',
    icon: '🎯',
    points: 50,
    status: 'unlocked' // 已解锁
  }
];

export const AchievementCardTest: React.FC = () => {
  const [unlockingAchievement, setUnlockingAchievement] = React.useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = React.useState<Set<string>>(new Set());

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

  const handleButtonClick = (achievement: any) => {
    if (achievement.status === 'locked') {
      alert('该成就尚未解锁！');
    } else if (achievement.status === 'unlockable') {
      // 开始解锁动画
      setUnlockingAchievement(achievement.id);
      
      // 模拟解锁过程
      setTimeout(() => {
        // 解锁完成，添加到已解锁列表
        setUnlockedAchievements(prev => new Set([...prev, achievement.id]));
        setUnlockingAchievement(null);
      }, 1000); // 1秒动画时间
    } else if (achievement.status === 'unlocked') {
      // 已解锁状态不响应点击
      return;
    }
  };

  return (
    <div>
      
      {/* 成就卡片容器 */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '20px', 
        alignItems: 'center' 
      }}>
        {mockAchievements.map((achievement) => {
          const styles = getStatusStyles(achievement.status);
          const isUnlocking = unlockingAchievement === achievement.id;
          const isUnlocked = unlockedAchievements.has(achievement.id);
          const currentStatus = isUnlocked ? 'unlocked' : achievement.status;
          const currentStyles = getStatusStyles(currentStatus);
          
          return (
            <div key={achievement.id} style={{ textAlign: 'center' }}>
              <div style={{
                width: '250px',
                height: '220px',
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
                padding: '20px 20px 25px 20px',
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
                    fontSize: '60px',
                    marginBottom: '12px',
                    lineHeight: '1',
                    filter: achievement.status === 'locked' ? 'grayscale(100%)' : 'none',
                    opacity: achievement.status === 'locked' ? 0.5 : 1
                  }}>
                    {achievement.icon}
                  </div>
                  
                  {/* 成就名称 */}
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    marginBottom: '6px',
                    lineHeight: '1.2',
                    color: achievement.status === 'locked' ? '#999' : '#333'
                  }}>
                    {achievement.name}
                  </div>
                  
                  {/* 成就描述 */}
                  <div style={{
                    fontSize: '12px',
                    color: achievement.status === 'locked' ? '#ccc' : '#666',
                    marginBottom: '4px',
                    lineHeight: '1.2'
                  }}>
                    {achievement.description}
                  </div>
                  
                  {/* 奖励积分 */}
                  <div style={{
                    fontSize: '14px',
                    color: achievement.status === 'locked' ? '#ccc' : '#ff6b35',
                    fontWeight: 'bold',
                    lineHeight: '1.2',
                    marginTop: '2px'
                  }}>
                    +{achievement.points} 积分
                  </div>
                </div>
                
                {/* 解锁按钮 */}
                <button 
                  disabled={currentStyles.buttonDisabled}
                  style={{
                    backgroundColor: currentStyles.buttonBg,
                    color: currentStyles.buttonColor,
                    border: 'none',
                    borderRadius: '15px',
                    padding: '8px 20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: currentStatus === 'unlocked' ? 'default' : (currentStyles.buttonDisabled ? 'not-allowed' : 'pointer'),
                    boxShadow: currentStatus === 'unlocked' ? 'none' : (currentStyles.buttonDisabled ? 'none' : '0 2px 4px rgba(0,0,0,0.2)'),
                    transition: currentStatus === 'unlocked' ? 'none' : 'all 0.3s ease',
                    minWidth: '100px',
                    opacity: currentStyles.buttonDisabled ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: 'auto',
                    marginTop: '15px',
                    outline: 'none'
                  }}
                  onClick={() => handleButtonClick(achievement)}>
                  {/* 锁图标 - 解锁动画 */}
                  {currentStatus === 'unlockable' && !isUnlocked && (
                    <div style={{
                      animation: isUnlocking ? 'lockOpen 1s ease-in-out' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UnlockIcon color={currentStyles.buttonColor} size={14} />
                    </div>
                  )}
                  
                  {/* 对勾图标 - 解锁完成，只在解锁完成后显示 */}
                  {(isUnlocked || currentStatus === 'unlocked') && !isUnlocking && (
                    <div style={{
                      animation: isUnlocked ? 'checkAppear 0.6s ease-out' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CheckIcon color={currentStyles.buttonColor} size={24} strokeWidth={3} />
                    </div>
                  )}
                  
                  {/* 锁定图标 */}
                  {currentStatus === 'locked' && (
                    <LockIcon color={currentStyles.buttonColor} size={14} />
                  )}
                </button>
              </div>
              
              {/* 状态标签 */}
              <div style={{
                marginTop: '8px',
                fontSize: '12px',
                color: currentStatus === 'locked' ? '#999' : 
                       currentStatus === 'unlockable' ? '#ff6b35' : '#52c41a',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}>
                {currentStatus === 'locked' ? (
                  <>
                    <LockIcon color="#999" size={12} />
                    <span>未解锁</span>
                  </>
                ) : currentStatus === 'unlockable' ? (
                  <>
                    <UnlockIcon color="#ff6b35" size={12} />
                    <span>可解锁</span>
                  </>
                ) : (
                  <>
                    <CheckIcon color="#52c41a" size={12} />
                    <span>已完成</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}; 