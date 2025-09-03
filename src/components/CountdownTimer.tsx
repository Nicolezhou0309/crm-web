import React, { useState, useEffect, useCallback } from 'react';
import { ClockCircleOutlined } from '@ant-design/icons';

interface CountdownTimerProps {
  targetTime: Date;
  onExpire?: () => void;
  format?: 'full' | 'compact' | 'minimal';
  showIcon?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetTime,
  onExpire,
  format = 'full',
  showIcon = true,
  className = '',
  style = {}
}) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 });
  const [isExpired, setIsExpired] = useState(false);

  const calculateTimeLeft = useCallback((): TimeLeft => {
    const now = new Date().getTime();
    const target = targetTime.getTime();
    const difference = target - now;

    // 添加调试日志
    if (process.env.NODE_ENV === 'development') {
    }

    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((difference % (1000 * 60)) / 1000),
      total: difference
    };
  }, [targetTime]);

  useEffect(() => {
    const updateTimer = () => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);

      if (newTimeLeft.total <= 0 && !isExpired) {
        setIsExpired(true);
        
        // 添加调试日志
        if (process.env.NODE_ENV === 'development') {
        }
        
        onExpire?.();
      }
    };

    // 立即更新一次
    updateTimer();

    // 设置定时器
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onExpire, isExpired]);

  const formatTime = (value: number): string => {
    return value.toString().padStart(2, '0');
  };

  const renderTime = () => {
    if (isExpired) {
      return <span style={{ color: '#ff4d4f', fontWeight: '600' }}>已截止</span>;
    }

    switch (format) {
      case 'minimal':
        if (timeLeft.days > 0) {
          return `${timeLeft.days}天${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`;
        } else if (timeLeft.hours > 0) {
          return `${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`;
        } else {
          return `${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`;
        }

      case 'compact':
        if (timeLeft.days > 0) {
          return `${timeLeft.days}天${timeLeft.hours}小时`;
        } else if (timeLeft.hours > 0) {
          return `${timeLeft.hours}小时${formatTime(timeLeft.minutes)}分钟`;
        } else {
          return `${formatTime(timeLeft.minutes)}分钟${formatTime(timeLeft.seconds)}秒`;
        }

      case 'full':
      default:
        if (timeLeft.days > 0) {
          return `${timeLeft.days}天 ${formatTime(timeLeft.hours)}:${formatTime(timeLeft.minutes)}:${formatTime(timeLeft.seconds)}`;
        } else if (timeLeft.hours > 0) {
          return `${formatTime(timeLeft.hours)}小时 ${formatTime(timeLeft.minutes)}分钟 ${formatTime(timeLeft.seconds)}秒`;
        } else {
          return `${formatTime(timeLeft.minutes)}分钟 ${formatTime(timeLeft.seconds)}秒`;
        }
    }
  };

  const getTimeColor = () => {
    if (isExpired) return '#ff4d4f';
    if (timeLeft.total <= 5 * 60 * 1000) return '#ff4d4f'; // 5分钟内红色
    if (timeLeft.total <= 30 * 60 * 1000) return '#fa8c16'; // 30分钟内橙色
    return '#52c41a'; // 绿色
  };

  return (
    <div 
      className={`countdown-timer ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '12px',
        fontWeight: '500',
        color: getTimeColor(),
        ...style
      }}
    >
      {showIcon && <ClockCircleOutlined style={{ fontSize: '12px' }} />}
      <span>{renderTime()}</span>
    </div>
  );
};

export default CountdownTimer;
