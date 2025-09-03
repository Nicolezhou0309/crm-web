import { useEffect, useRef, useCallback } from 'react';

// 日志记录函数
const logSessionEvent = (event: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`⏰ [useSessionTimeout] ${event}`, {
      timestamp: new Date().toISOString(),
      ...data
    });
  }
};

interface SessionTimeoutConfig {
  timeoutMs: number;
  warningThresholdMs: number;
  checkIntervalMs: number;
}

export const useSessionTimeout = (config: SessionTimeoutConfig = {
  timeoutMs: 30 * 60 * 1000, // 30分钟
  warningThresholdMs: 5 * 60 * 1000, // 5分钟警告
  checkIntervalMs: 60 * 1000, // 每分钟检查
}) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isWarningShownRef = useRef<boolean>(false);

  const resetTimeout = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    logSessionEvent('重置会话超时', {
      timeSinceLastActivity: timeSinceLastActivity,
      timeoutMs: config.timeoutMs,
      warningThresholdMs: config.warningThresholdMs,
      wasWarningShown: isWarningShownRef.current
    });
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    lastActivityRef.current = now;
    isWarningShownRef.current = false;
    
    // 设置新的超时
    timeoutRef.current = setTimeout(() => {
      logSessionEvent('会话超时触发', {
        timeoutMs: config.timeoutMs,
        action: 'session_expired'
      });
      // 触发会话过期事件
      window.dispatchEvent(new CustomEvent('sessionExpired'));
    }, config.timeoutMs);
  }, [config.timeoutMs, config.warningThresholdMs]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // 只有在活动间隔超过1秒时才更新，避免频繁更新
    if (timeSinceLastActivity > 1000) {
      logSessionEvent('用户活动检测', {
        timeSinceLastActivity: timeSinceLastActivity,
        wasWarningShown: isWarningShownRef.current,
        action: 'user_activity'
      });
      
      lastActivityRef.current = now;
      
      // 如果正在显示警告，隐藏它
      if (isWarningShownRef.current) {
        logSessionEvent('隐藏会话警告', {
          action: 'hide_warning'
        });
        window.dispatchEvent(new CustomEvent('sessionWarningHide'));
        isWarningShownRef.current = false;
      }
    }
  }, []);

  const checkSessionStatus = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    const timeRemaining = Math.max(0, config.timeoutMs - timeSinceLastActivity);
    
    // 记录定期检查状态
    logSessionEvent('会话状态检查', {
      timeSinceLastActivity: timeSinceLastActivity,
      timeRemaining: timeRemaining,
      warningThresholdMs: config.warningThresholdMs,
      isWarningShown: isWarningShownRef.current,
      checkInterval: config.checkIntervalMs
    });
    
    // 检查是否需要显示警告
    if (timeRemaining <= config.warningThresholdMs && timeRemaining > 0 && !isWarningShownRef.current) {
      logSessionEvent('显示会话警告', {
        timeRemaining: timeRemaining,
        warningThresholdMs: config.warningThresholdMs,
        action: 'show_warning'
      });
      window.dispatchEvent(new CustomEvent('sessionWarningShow', {
        detail: { timeRemaining }
      }));
      isWarningShownRef.current = true;
    }
    
    // 检查是否超时
    if (timeSinceLastActivity >= config.timeoutMs) {
      logSessionEvent('会话超时检查通过', {
        timeSinceLastActivity: timeSinceLastActivity,
        timeoutMs: config.timeoutMs,
        action: 'timeout_check'
      });
      window.dispatchEvent(new CustomEvent('sessionExpired'));
    }
  }, [config.timeoutMs, config.warningThresholdMs, config.checkIntervalMs]);

  useEffect(() => {
    logSessionEvent('useSessionTimeout 初始化', {
      timeoutMs: config.timeoutMs,
      warningThresholdMs: config.warningThresholdMs,
      checkIntervalMs: config.checkIntervalMs
    });
    
    // 监听用户活动（使用节流）
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    let throttleTimer: NodeJS.Timeout | null = null;
    
    const throttledHandleActivity = () => {
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(() => {
        handleActivity();
        throttleTimer = null;
      }, 1000); // 1秒节流
    };
    
    events.forEach(event => {
      document.addEventListener(event, throttledHandleActivity, { passive: true });
    });

    // 启动会话状态检查
    checkIntervalRef.current = setInterval(checkSessionStatus, config.checkIntervalMs);
    
    // 初始化超时
    resetTimeout();

    return () => {
      logSessionEvent('useSessionTimeout 清理', {
        action: 'cleanup'
      });
      
      events.forEach(event => {
        document.removeEventListener(event, throttledHandleActivity);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [handleActivity, checkSessionStatus, resetTimeout, config.checkIntervalMs, config.timeoutMs, config.warningThresholdMs]);

  return {
    resetTimeout,
    handleActivity,
    getTimeRemaining: () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      return Math.max(0, config.timeoutMs - timeSinceLastActivity);
    },
    getLastActivityTime: () => lastActivityRef.current,
  };
};