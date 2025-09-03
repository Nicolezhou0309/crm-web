import React, { useState, useEffect, useCallback, useRef } from 'react';
import CountdownTimer from './CountdownTimer';
import { liveStreamRegistrationService, type RegistrationConfig } from '../services/LiveStreamRegistrationService';

interface RegistrationCountdownProps {
  config: RegistrationConfig | null;
  isPrivilegeUser: boolean;
  onTimeWindowChange?: (canRegister: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
}

interface TimeWindowInfo {
  nextOpenTime: Date | null;
  nextCloseTime: Date | null;
  currentWindow: 'normal' | 'privilege' | 'closed' | null;
  isCurrentlyOpen: boolean;
}

const RegistrationCountdown: React.FC<RegistrationCountdownProps> = ({
  config,
  isPrivilegeUser,
  onTimeWindowChange,
  className = '',
  style = {}
}) => {
  const [timeWindowInfo, setTimeWindowInfo] = useState<TimeWindowInfo>({
    nextOpenTime: null,
    nextCloseTime: null,
    currentWindow: null,
    isCurrentlyOpen: false
  });

  // 使用 ref 来存储最新的 onTimeWindowChange 回调，避免循环依赖
  const onTimeWindowChangeRef = useRef(onTimeWindowChange);
  onTimeWindowChangeRef.current = onTimeWindowChange;

  // 计算下一个时间窗口
  const calculateNextTimeWindow = useCallback((): TimeWindowInfo => {
    if (!config) {
      return {
        nextOpenTime: null,
        nextCloseTime: null,
        currentWindow: null,
        isCurrentlyOpen: false
      };
    }

    const now = new Date();
    // 正确获取北京时间：使用toLocaleString转换为北京时间
    const beijingTimeStr = now.toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    // 解析北京时间字符串
    const [datePart, timePart] = beijingTimeStr.split(' ');
    const [year, month, day] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    
    // 创建北京时间的Date对象
    const beijingNow = new Date(year, month - 1, day, hours, minutes, seconds);
    const currentDay = beijingNow.getDay() === 0 ? 7 : beijingNow.getDay();
    const currentTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // 添加调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🕐 [RegistrationCountdown] 时间计算调试:', {
        timestamp: new Date().toISOString(),
        utcTime: now.toISOString(),
        beijingTimeStr: beijingTimeStr,
        beijingNow: beijingNow.toISOString(),
        currentDay: currentDay,
        currentTime: currentTime,
        config: {
          registration_open_day_of_week: config.registration_open_day_of_week,
          registration_open_time: config.registration_open_time,
          registration_close_day_of_week: config.registration_close_day_of_week,
          registration_close_time: config.registration_close_time
        }
      });
    }

    // 解析时间字符串 (HH:MM)
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return { hours, minutes };
    };

    // 创建指定日期和时间的Date对象
    const createDateTime = (dayOfWeek: number, timeStr: string) => {
      const { hours, minutes } = parseTime(timeStr);
      
      // 计算目标日期（本周或下周）
      const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
      const targetDate = new Date(beijingNow);
      targetDate.setDate(beijingNow.getDate() + daysUntilTarget);
      targetDate.setHours(hours, minutes, 0, 0);
      
      // 如果目标时间已过，则设置为下周
      if (targetDate.getTime() <= beijingNow.getTime()) {
        targetDate.setDate(targetDate.getDate() + 7);
      }
      
      // 添加调试日志
      if (process.env.NODE_ENV === 'development') {
        console.log('🕐 [RegistrationCountdown] createDateTime 调试:', {
          dayOfWeek: dayOfWeek,
          timeStr: timeStr,
          hours: hours,
          minutes: minutes,
          currentDay: currentDay,
          daysUntilTarget: daysUntilTarget,
          targetDate: targetDate.toISOString(),
          beijingNow: beijingNow.toISOString(),
          isTargetPassed: targetDate.getTime() <= beijingNow.getTime()
        });
      }
      
      return targetDate;
    };

    // 检查当前是否在时间窗口内
    const checkCurrentWindow = () => {
      // 检查VIP主播时间窗口
      if (isPrivilegeUser) {
        const privilegeStart = createDateTime(config.privilege_advance_open_day_of_week, config.privilege_advance_open_time);
        const privilegeEnd = createDateTime(config.privilege_advance_close_day_of_week, config.privilege_advance_close_time);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🕐 [RegistrationCountdown] VIP主播时间窗口检查:', {
            beijingNow: beijingNow.toISOString(),
            privilegeStart: privilegeStart.toISOString(),
            privilegeEnd: privilegeEnd.toISOString(),
            isInPrivilegeWindow: beijingNow >= privilegeStart && beijingNow <= privilegeEnd
          });
        }
        
        if (beijingNow >= privilegeStart && beijingNow <= privilegeEnd) {
          return {
            currentWindow: 'privilege' as const,
            isCurrentlyOpen: true,
            nextCloseTime: privilegeEnd
          };
        }
      }

      // 检查普通用户时间窗口
      const normalStart = createDateTime(config.registration_open_day_of_week, config.registration_open_time);
      const normalEnd = createDateTime(config.registration_close_day_of_week, config.registration_close_time);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🕐 [RegistrationCountdown] 普通用户时间窗口检查:', {
          beijingNow: beijingNow.toISOString(),
          normalStart: normalStart.toISOString(),
          normalEnd: normalEnd.toISOString(),
          isInNormalWindow: beijingNow >= normalStart && beijingNow <= normalEnd
        });
      }
      
      if (beijingNow >= normalStart && beijingNow <= normalEnd) {
        return {
          currentWindow: 'normal' as const,
          isCurrentlyOpen: true,
          nextCloseTime: normalEnd
        };
      }

      // 当前不在任何时间窗口内，计算下次开放时间
      // VIP主播用户需要比较VIP时间窗口和普通时间窗口，选择最近的一个
      let nextOpenTime: Date;
      
      if (isPrivilegeUser) {
        const privilegeNextOpen = createDateTime(config.privilege_advance_open_day_of_week, config.privilege_advance_open_time);
        const normalNextOpen = createDateTime(config.registration_open_day_of_week, config.registration_open_time);
        
        // 选择最近的时间窗口
        nextOpenTime = privilegeNextOpen.getTime() < normalNextOpen.getTime() ? privilegeNextOpen : normalNextOpen;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🕐 [RegistrationCountdown] VIP主播用户时间窗口比较:', {
            privilegeNextOpen: privilegeNextOpen.toISOString(),
            normalNextOpen: normalNextOpen.toISOString(),
            selectedNextOpen: nextOpenTime.toISOString(),
            isPrivilegeEarlier: privilegeNextOpen.getTime() < normalNextOpen.getTime()
          });
        }
      } else {
        nextOpenTime = createDateTime(config.registration_open_day_of_week, config.registration_open_time);
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🕐 [RegistrationCountdown] 时间窗口关闭，计算下次开放时间:', {
          isPrivilegeUser: isPrivilegeUser,
          nextOpenTime: nextOpenTime.toISOString(),
          timeUntilNextOpen: nextOpenTime.getTime() - beijingNow.getTime(),
          timeUntilNextOpenMinutes: Math.round((nextOpenTime.getTime() - beijingNow.getTime()) / (1000 * 60))
        });
      }
      
      return {
        currentWindow: 'closed' as const,
        isCurrentlyOpen: false,
        nextOpenTime: nextOpenTime
      };
    };

    const windowInfo = checkCurrentWindow();
    
    return {
      ...windowInfo,
      nextOpenTime: windowInfo.nextOpenTime || null,
      nextCloseTime: windowInfo.nextCloseTime || null
    };
  }, [config, isPrivilegeUser]);

  // 更新时间窗口信息
  useEffect(() => {
    const updateTimeWindow = () => {
      const newTimeWindowInfo = calculateNextTimeWindow();
      setTimeWindowInfo(prevInfo => {
        // 只有当时间窗口状态真正改变时才触发回调
        if (prevInfo.isCurrentlyOpen !== newTimeWindowInfo.isCurrentlyOpen) {
          onTimeWindowChangeRef.current?.(newTimeWindowInfo.isCurrentlyOpen);
        }
        return newTimeWindowInfo;
      });
    };

    // 立即更新一次
    updateTimeWindow();

    // 每分钟更新一次
    const interval = setInterval(updateTimeWindow, 60000);

    return () => clearInterval(interval);
  }, [config, isPrivilegeUser]); // 直接依赖原始值，而不是函数

  // 处理倒计时结束
  const handleCountdownExpire = useCallback(() => {
    // 添加调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🕐 [RegistrationCountdown] 倒计时结束，重新计算时间窗口:', {
        timestamp: new Date().toISOString(),
        currentWindowInfo: timeWindowInfo,
        isPrivilegeUser: isPrivilegeUser
      });
    }
    
    // 重新计算时间窗口
    const newTimeWindowInfo = calculateNextTimeWindow();
    setTimeWindowInfo(prevInfo => {
      // 只有当时间窗口状态真正改变时才触发回调
      if (prevInfo.isCurrentlyOpen !== newTimeWindowInfo.isCurrentlyOpen) {
        onTimeWindowChangeRef.current?.(newTimeWindowInfo.isCurrentlyOpen);
      }
      return newTimeWindowInfo;
    });
    
    // 添加调试日志
    if (process.env.NODE_ENV === 'development') {
      console.log('🕐 [RegistrationCountdown] 时间窗口重新计算完成:', {
        newWindowInfo: newTimeWindowInfo,
        isCurrentlyOpen: newTimeWindowInfo.isCurrentlyOpen,
        hasOnTimeWindowChange: !!onTimeWindowChange
      });
    }
  }, [config, isPrivilegeUser]); // 直接依赖原始值，而不是函数

  if (!config) {
    return null;
  }

  const getWindowTypeText = () => {
    if (timeWindowInfo.currentWindow === 'privilege') {
      return '报名时间';
    } else if (timeWindowInfo.currentWindow === 'normal') {
      return '报名时间';
    } else {
      return '报名时间';
    }
  };

  const getWindowTypeColor = () => {
    if (timeWindowInfo.currentWindow === 'privilege') {
      return '#722ed1';
    } else if (timeWindowInfo.currentWindow === 'normal') {
      return '#1890ff';
    } else {
      return '#d9d9d9';
    }
  };

  return (
    <div 
      className={`registration-countdown ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '4px',
        ...style
      }}
    >
      {/* 当前时间窗口状态 - 已隐藏 */}
      {/* <div style={{
        fontSize: '12px',
        color: getWindowTypeColor(),
        fontWeight: '500'
      }}>
        {getWindowTypeText()}
      </div> */}

      {/* 倒计时显示 */}
      {timeWindowInfo.isCurrentlyOpen && timeWindowInfo.nextCloseTime && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>距离截止还有：</span>
          <CountdownTimer
            targetTime={timeWindowInfo.nextCloseTime}
            onExpire={handleCountdownExpire}
            format="compact"
            showIcon={true}
            style={{ fontSize: '12px', fontWeight: '600' }}
          />
        </div>
      )}

      {!timeWindowInfo.isCurrentlyOpen && timeWindowInfo.nextOpenTime && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>下次开放还有：</span>
          <CountdownTimer
            targetTime={timeWindowInfo.nextOpenTime}
            onExpire={handleCountdownExpire}
            format="compact"
            showIcon={true}
            style={{ fontSize: '12px', fontWeight: '600' }}
          />
        </div>
      )}

      {/* 时间窗口信息 */}
      <div style={{ fontSize: '12px', color: '#999', textAlign: 'right' }}>
        {liveStreamRegistrationService.getTimeWindowInfo(config)}
      </div>
    </div>
  );
};

export default RegistrationCountdown;
