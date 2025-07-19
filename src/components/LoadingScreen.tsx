import React, { useState, useEffect } from 'react';
import { getRandomLoadingMessage, getLoadingMessageByType } from '../utils/loadingMessages';

interface LoadingScreenProps {
  message?: string;
  subtitle?: string;
  showProgress?: boolean;
  type?: 'auth' | 'data' | 'profile' | 'system' | 'random';
  useRandomMessage?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message,
  subtitle,
  showProgress = true,
  type,
  useRandomMessage = false
}) => {
  const [loadingMessage, setLoadingMessage] = useState(() => {
    if (message && subtitle) {
      return { message, subtitle };
    }
    if (type && type !== 'random') {
      return getLoadingMessageByType(type);
    }
    if (useRandomMessage) {
      return getRandomLoadingMessage();
    }
    return getRandomLoadingMessage();
  });

  // 如果使用随机消息，定期更换消息
  useEffect(() => {
    if (useRandomMessage) {
      const interval = setInterval(() => {
        setLoadingMessage(getRandomLoadingMessage());
      }, 5000); // 每5秒更换一次消息

      return () => clearInterval(interval);
    }
  }, [useRandomMessage]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 50%, #f1f3f4 100%)',
      color: '#333',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.03) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      {/* 加载动画 */}
      <div style={{
        width: 80,
        height: 80,
        border: '3px solid #e8eaed',
        borderTop: '3px solid #1890ff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: 32,
        position: 'relative',
        zIndex: 1
      }} />
      
      {/* 主标题 */}
      <div style={{
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: 16,
        textAlign: 'center',
        color: '#1a1a1a',
        position: 'relative',
        zIndex: 1
      }}>
        {loadingMessage.message}
      </div>
      
      {/* 副标题 */}
      <div style={{
        fontSize: '16px',
        color: '#666',
        textAlign: 'center',
        maxWidth: 400,
        lineHeight: 1.6,
        position: 'relative',
        zIndex: 1
      }}>
        {loadingMessage.subtitle}
      </div>
      
      {/* 进度指示器 */}
      {showProgress && (
        <div style={{
          marginTop: 40,
          width: 240,
          height: 6,
          backgroundColor: '#f0f0f0',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 1,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, #1890ff 0%, #40a9ff 50%, #1890ff 100%)',
            borderRadius: 3,
            animation: 'progress 2s ease-in-out infinite',
            width: '30%',
            boxShadow: '0 1px 3px rgba(24, 144, 255, 0.3)'
          }} />
        </div>
      )}
      
      {/* 小提示 */}
      <div style={{
        marginTop: 32,
        fontSize: '14px',
        color: '#999',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        如果加载时间过长，请检查网络连接
      </div>
      
      {/* 装饰性元素 */}
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '10%',
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(24, 144, 255, 0.1) 0%, rgba(24, 144, 255, 0.05) 100%)',
        animation: 'float 3s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      
      <div style={{
        position: 'absolute',
        bottom: '20%',
        left: '10%',
        width: 60,
        height: 60,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(82, 196, 26, 0.1) 0%, rgba(82, 196, 26, 0.05) 100%)',
        animation: 'float 4s ease-in-out infinite reverse',
        pointerEvents: 'none'
      }} />
      
      {/* 添加CSS动画 */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(-100%); }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen; 