import { useCallback, useRef, useMemo } from 'react';
import { supabase } from '../supaClient';

// 防抖函数类型定义
type DebouncedFunction<T extends (...args: any[]) => any> = T & { cancel: () => void };

// 简单的防抖函数实现
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): DebouncedFunction<T> {
  let timeout: NodeJS.Timeout | null = null;
  
  const debounced = ((...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as DebouncedFunction<T>;
  
  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };
  
  return debounced;
}

/**
 * 优化的实时事件处理器 Hook
 * 解决 message handler 性能问题
 */
export function useOptimizedRealtimeHandler() {
  // 用户信息缓存
  const userCache = useRef<Map<string, any>>(new Map());
  
  // 防抖函数缓存
  const debouncedHandlers = useRef<Map<string, DebouncedFunction<(...args: any[]) => void>>>(new Map());

  /**
   * 获取防抖处理器
   */
  const getDebouncedHandler = useCallback((
    key: string, 
    handler: (...args: any[]) => void, 
    delay: number = 300
  ): DebouncedFunction<(...args: any[]) => void> => {
    if (!debouncedHandlers.current.has(key)) {
      debouncedHandlers.current.set(key, debounce(handler, delay));
    }
    return debouncedHandlers.current.get(key)!;
  }, []);

  /**
   * 异步获取用户信息（带缓存）
   */
  const getCachedUserInfo = useCallback(async (userId: string) => {
    // 检查缓存
    if (userCache.current.has(userId)) {
      return userCache.current.get(userId);
    }

    try {
      // 异步获取用户信息，不阻塞主线程
      const { data: userProfile } = await supabase
        .from('users_profile')
        .select('nickname, email')
        .eq('id', userId)
        .single();

      const userInfo = {
        nickname: userProfile?.nickname,
        email: userProfile?.email,
        displayName: userProfile?.nickname || userProfile?.email || '未知用户'
      };

      // 缓存结果
      userCache.current.set(userId, userInfo);
      
      // 设置缓存过期时间（5分钟）
      setTimeout(() => {
        userCache.current.delete(userId);
      }, 5 * 60 * 1000);

      return userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return { displayName: '未知用户' };
    }
  }, []);

  /**
   * 优化的状态更新处理器
   */
  const createOptimizedStateUpdater = useCallback(<T>(
    updateFn: (prev: T) => T,
    key: string,
    delay: number = 100
  ) => {
    return getDebouncedHandler(key, updateFn, delay);
  }, [getDebouncedHandler]);

  /**
   * 批量处理实时事件
   */
  const createBatchProcessor = useCallback(<T>(
    processor: (items: T[]) => void,
    key: string,
    delay: number = 200
  ) => {
    const batch: T[] = [];
    
    const processBatch = getDebouncedHandler(key, () => {
      if (batch.length > 0) {
        processor([...batch]);
        batch.length = 0; // 清空批次
      }
    }, delay);

    return (item: T) => {
      batch.push(item);
      processBatch();
    };
  }, [getDebouncedHandler]);

  /**
   * 性能监控包装器
   */
  const withPerformanceMonitoring = useCallback((
    handler: Function,
    handlerName: string,
    threshold: number = 50
  ) => {
    return async (...args: any[]) => {
      const startTime = performance.now();
      
      try {
        await handler(...args);
      } finally {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (duration > threshold) {
          console.warn(`⚠️ [实时性能] ${handlerName} 处理耗时 ${duration.toFixed(2)}ms`);
        }
      }
    };
  }, []);

  /**
   * 清理函数
   */
  const cleanup = useCallback(() => {
    // 清理防抖函数
    debouncedHandlers.current.forEach(handler => {
      if (handler && 'cancel' in handler && typeof handler.cancel === 'function') {
        handler.cancel();
      }
    });
    debouncedHandlers.current.clear();
    
    // 清理缓存
    userCache.current.clear();
  }, []);

  return {
    getDebouncedHandler,
    getCachedUserInfo,
    createOptimizedStateUpdater,
    createBatchProcessor,
    withPerformanceMonitoring,
    cleanup
  };
}

/**
 * 实时事件处理器性能优化工具
 */
export class RealtimePerformanceOptimizer {
  private static instance: RealtimePerformanceOptimizer;
  private userCache = new Map<string, any>();
  private debouncedHandlers = new Map<string, DebouncedFunction<(...args: any[]) => void>>();
  private performanceMetrics = new Map<string, number[]>();

  static getInstance(): RealtimePerformanceOptimizer {
    if (!RealtimePerformanceOptimizer.instance) {
      RealtimePerformanceOptimizer.instance = new RealtimePerformanceOptimizer();
    }
    return RealtimePerformanceOptimizer.instance;
  }

  /**
   * 记录性能指标
   */
  recordPerformance(handlerName: string, duration: number) {
    if (!this.performanceMetrics.has(handlerName)) {
      this.performanceMetrics.set(handlerName, []);
    }
    
    const metrics = this.performanceMetrics.get(handlerName)!;
    metrics.push(duration);
    
    // 只保留最近100次记录
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    // 如果超过阈值，发出警告
    if (duration > 100) {
      const avgDuration = metrics.reduce((a, b) => a + b, 0) / metrics.length;
      console.warn(`⚠️ [实时性能] ${handlerName} 当前耗时: ${duration.toFixed(2)}ms, 平均耗时: ${avgDuration.toFixed(2)}ms`);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(handlerName: string) {
    const metrics = this.performanceMetrics.get(handlerName) || [];
    if (metrics.length === 0) return null;
    
    const avg = metrics.reduce((a, b) => a + b, 0) / metrics.length;
    const max = Math.max(...metrics);
    const min = Math.min(...metrics);
    
    return { avg, max, min, count: metrics.length };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.userCache.clear();
    this.debouncedHandlers.forEach(handler => {
      if (handler && 'cancel' in handler && typeof handler.cancel === 'function') {
        handler.cancel();
      }
    });
    this.debouncedHandlers.clear();
    this.performanceMetrics.clear();
  }
}
