// 统一的重试机制工具
export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  backoff?: 'fixed' | 'exponential';
  onRetry?: (attempt: number, error: any) => void;
  shouldRetry?: (error: any) => boolean;
}

// 网络连接状态监控
let isOnline = navigator.onLine;
const networkListeners: Array<() => void> = [];

// 监听网络状态变化
window.addEventListener('online', () => {
  isOnline = true;
  networkListeners.forEach(listener => listener());
});

window.addEventListener('offline', () => {
  isOnline = false;
});

export const getNetworkStatus = () => isOnline;

export const addNetworkListener = (listener: () => void) => {
  networkListeners.push(listener);
};

export const removeNetworkListener = (listener: () => void) => {
  const index = networkListeners.indexOf(listener);
  if (index > -1) {
    networkListeners.splice(index, 1);
  }
};

export class RetryManager {
  private static instance: RetryManager;
  private retryCache = new Map<string, { count: number; lastRetry: number }>();

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  // 带重试的API调用包装器
  async withRetry<T>(
    apiCall: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 'exponential',
      onRetry,
      shouldRetry
    } = options;

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 检查网络状态
        if (!isOnline) {
          throw new Error('网络连接已断开');
        }

        return await apiCall();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否应该重试
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }
        
        // 记录重试信息
        this.recordRetry(apiCall.name || 'unknown', error);
        
        console.warn(`API调用失败，第${attempt}次重试:`, {
          error: error.message,
          attempt,
          maxRetries
        });
        
        // 调用重试回调
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        if (attempt < maxRetries) {
          // 计算延迟时间
          const currentDelay = backoff === 'exponential' 
            ? delay * Math.pow(2, attempt - 1)
            : delay;
          
          await new Promise(resolve => setTimeout(resolve, currentDelay));
        }
      }
    }
    
    throw lastError;
  }

  // 记录重试统计
  private recordRetry(apiName: string, error: any) {
    const key = `${apiName}_${error.message}`;
    const existing = this.retryCache.get(key) || { count: 0, lastRetry: 0 };
    
    existing.count++;
    existing.lastRetry = Date.now();
    
    this.retryCache.set(key, existing);
  }

  // 获取重试统计
  getRetryStats() {
    return Array.from(this.retryCache.entries()).map(([key, stats]) => ({
      api: key,
      retryCount: stats.count,
      lastRetry: new Date(stats.lastRetry)
    }));
  }

  // 清除重试缓存
  clearRetryCache() {
    this.retryCache.clear();
  }
}

// 默认重试实例
export const retryManager = RetryManager.getInstance();

// 便捷的重试函数
export async function withRetry<T>(
  apiCall: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryManager.withRetry(apiCall, options);
}

// 针对Supabase的特殊重试配置
export const supabaseRetryOptions: RetryOptions = {
  maxRetries: 3,
  delay: 1000,
  backoff: 'exponential',
  shouldRetry: (error: any) => {
    // 网络错误、超时、服务器错误等应该重试
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'ConnectionError',
      'fetch failed',
      'Failed to fetch',
      'net::ERR_CONNECTION_TIMED_OUT',
      'net::ERR_NETWORK',
      'net::ERR_CONNECTION_CLOSED',
      '500',
      '502',
      '503',
      '504'
    ];
    
    return retryableErrors.some(pattern => 
      error.message?.includes(pattern) || 
      error.code?.includes(pattern) ||
      error.status?.toString().includes(pattern)
    );
  },
  onRetry: (_attempt, _error) => {
  }
};

// 防抖函数
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// 节流函数
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}; 